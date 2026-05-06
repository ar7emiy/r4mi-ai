"""NarrowAgent — site-agnostic spec executor.

Executes a published NarrowAgentSpec against a target session's captured
context. The 5-action dispatch (READ/FETCH/REASON/WRITE/ASSERT) replaces
the previous permit-domain field-name lookups. There is no domain
knowledge in this module: every value comes from either captured network
calls (for FETCH), prior step values (for REASON/WRITE/ASSERT via
template interpolation), or the host page DOM (for READ/WRITE — the
host page is responsible for actually touching the DOM via
element_resolver.js).
"""
from __future__ import annotations
import asyncio
import json
import os
import re
import time
from typing import AsyncIterator, Optional
from urllib.parse import urlparse

from google import genai
from sqlmodel import Session

from models.agent_spec import NarrowAgentSpec, TrustLevel  # noqa: F401
from models.event import SSEEventType
from models.session import SessionRecord
from services.exceptions import QuotaExhaustedException
from services.log_streamer import logger


# ── Template interpolation ────────────────────────────────────────────────────
_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z0-9_.\[\]]+)\}")


def _interpolate(template: Optional[str], values: dict) -> str:
    """Substitute {step.N.value} or {key} placeholders from a flat values map."""
    if not template:
        return ""

    def repl(m: re.Match) -> str:
        key = m.group(1)
        if key in values:
            return str(values[key])
        # Try dotted lookup (e.g., step.1.value)
        parts = key.split(".")
        cur = values
        for p in parts:
            if isinstance(cur, dict) and p in cur:
                cur = cur[p]
            else:
                return m.group(0)  # leave placeholder if unresolved
        return str(cur)

    return _PLACEHOLDER_RE.sub(repl, template)


# ── URL pattern matching for FETCH ────────────────────────────────────────────
def _url_template_to_regex(url_template: str) -> re.Pattern:
    """Convert /apps/{id}/form to a regex with capture groups for placeholders.

    Matches the path component only — query strings and origin are ignored
    so that fetches recorded as absolute URLs still match templates expressed
    as relative paths.
    """
    # Extract path component
    path = url_template
    if "://" in path:
        try:
            path = urlparse(path).path or "/"
        except Exception:
            pass
    # Escape regex specials except braces
    pattern = re.escape(path).replace(r"\{", "{").replace(r"\}", "}")
    pattern = re.sub(r"\{[^}]+\}", "[^/]+", pattern)
    return re.compile("^" + pattern + "$")


def _path_of(url: str) -> str:
    if "://" in url:
        try:
            return urlparse(url).path or "/"
        except Exception:
            return url
    return url.split("?")[0]


def find_matching_network_call(
    method: str,
    url_template: str,
    network_calls: list[dict],
) -> Optional[dict]:
    """Find the most recent captured call whose method matches and path
    matches the template. Prefers 2xx responses.
    """
    if not network_calls or not url_template:
        return None
    method = (method or "GET").upper()
    pattern = _url_template_to_regex(url_template)
    candidates = [
        c for c in network_calls
        if (c.get("method") or "").upper() == method
        and pattern.match(_path_of(c.get("url", "")))
    ]
    if not candidates:
        return None
    # Prefer successful responses, then most recent
    candidates.sort(
        key=lambda c: (
            1 if 200 <= int(c.get("response_status") or 0) < 300 else 0,
            c.get("timestamp", ""),
        ),
        reverse=True,
    )
    return candidates[0]


def _extract_response_value(body: Optional[str], jsonpath: Optional[str]) -> str:
    """Extract a value from a captured response body using a simple jsonpath
    (dot-walk only — e.g., "results.0.zone"). Returns the raw body if no
    jsonpath provided or extraction fails.
    """
    if not body:
        return ""
    if not jsonpath:
        return body
    try:
        data = json.loads(body)
    except Exception:
        return body
    cur = data
    for part in jsonpath.split("."):
        if isinstance(cur, list):
            try:
                cur = cur[int(part)]
                continue
            except (ValueError, IndexError):
                return ""
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
            continue
        return ""
    if isinstance(cur, (str, int, float, bool)):
        return str(cur)
    return json.dumps(cur)


# ── Reasoning via Gemini ──────────────────────────────────────────────────────
class _ReasonClient:
    def __init__(self):
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        if self._client is None:
            self._client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        return self._client

    async def reason(self, prompt: str) -> str:
        t0 = time.time()
        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"max_output_tokens": 200},
            )
        except Exception as e:
            msg = str(e)
            if any(k in msg for k in ("429", "quota", "RESOURCE_EXHAUSTED", "Quota")):
                raise QuotaExhaustedException(msg) from e
            raise
        latency_ms = int((time.time() - t0) * 1000)
        result = (response.text or "").strip()
        logger.info(f"[NarrowAgent.reason] gemini-2.5-flash | {latency_ms}ms | \"{result[:80]}\"")
        return result


_reason_client = _ReasonClient()


# ── Assertion evaluation ──────────────────────────────────────────────────────
def _evaluate_assertion(expression: str, values: dict) -> bool:
    """Tiny safe assertion evaluator. Supports comparisons of interpolated
    values: "{step.1.value} == 'R-2'", "{step.2.value} <= 6", etc.
    """
    interpolated = _interpolate(expression, values)
    # Whitelist a tiny grammar: <token> <op> <token>
    m = re.match(r"^\s*(.+?)\s*(==|!=|<=|>=|<|>|in)\s*(.+?)\s*$", interpolated)
    if not m:
        return bool(interpolated)  # truthy fallback
    left, op, right = m.group(1), m.group(2), m.group(3)
    left = left.strip().strip("'\"")
    right = right.strip().strip("'\"")
    try:
        ln = float(left)
        rn = float(right)
        return {
            "==": ln == rn, "!=": ln != rn,
            "<=": ln <= rn, ">=": ln >= rn,
            "<":  ln < rn,  ">":  ln > rn,
        }.get(op, False)
    except ValueError:
        return {
            "==": left == right, "!=": left != right,
            "<=": left <= right, ">=": left >= right,
            "<":  left < right,  ">":  left > right,
            "in": left in right,
        }.get(op, False)


# ── NarrowAgent ───────────────────────────────────────────────────────────────
class NarrowAgent:
    """Executes a NarrowAgentSpec by streaming AGENT_DEMO_STEP events.

    The agent is purely a coordinator: it does NOT touch the DOM and does
    NOT fetch anything itself. For READ/WRITE steps, it emits the
    fingerprint and the host page (via r4mi-loader.js + element_resolver.js)
    performs the action. For FETCH steps, it looks up the captured response
    from the session's network_calls — that's the value the worker observed
    when teaching r4mi the workflow. REASON steps invoke Gemini directly.
    ASSERT steps are evaluated in-process.
    """

    async def execute(
        self,
        spec: NarrowAgentSpec,
        session: Optional[SessionRecord],
        db: Session,
    ) -> AsyncIterator[dict]:
        """Yield {event, data} payloads for the SSE bus. Caller is responsible
        for routing them to clients.
        """
        logger.info(
            f"[NarrowAgent] Starting execution: '{spec.name}' "
            f"(trust={spec.trust_level}, cluster={spec.cluster_label!r})"
        )

        steps = spec.action_sequence or []
        network_calls = list(session.network_calls or []) if session else []
        # Per-step output map (used for template interpolation in later steps)
        values: dict[str, dict] = {"step": {}}
        completed_steps: list[dict] = []
        failed = False

        for step_def in steps:
            step_num = step_def.get("step", 0)
            action = (step_def.get("action") or "").lower()
            description = step_def.get("description", "")
            logger.info(f"[NarrowAgent] Step {step_num}: {action} | {description}")

            try:
                result = await self._execute_step(step_def, network_calls, values)
            except Exception as exc:
                logger.error(f"[NarrowAgent] Step {step_num} failed: {exc}")
                failed = True
                result = {
                    "value": "",
                    "source_tag": f"error: {exc}",
                    "confidence": 0.0,
                }

            values["step"][str(step_num)] = result

            step_result = {
                "step": step_num,
                "action": action,
                "description": description,
                "value": result.get("value", ""),
                "source_tag": result.get("source_tag", ""),
                "confidence": result.get("confidence", 0.5),
                "target_fingerprint": step_def.get("target_fingerprint"),
                "source_fetch": step_def.get("source_fetch"),
                "status": "ok" if result.get("value") or action in ("assert", "reason") else "empty",
            }
            completed_steps.append(step_result)

            yield {
                "event": SSEEventType.AGENT_DEMO_STEP,
                "data": step_result,
            }
            await asyncio.sleep(0.1)  # let SSE flush before the next step

        # Update run counters
        if spec in db:  # only if attached
            db.refresh(spec)
        if failed:
            spec.failed_runs += 1
        else:
            spec.successful_runs += 1
        db.add(spec)
        db.commit()

        logger.info(
            f"[NarrowAgent] Complete: '{spec.name}' | "
            f"runs={spec.successful_runs + spec.failed_runs}"
        )
        yield {
            "event": SSEEventType.AGENT_RUN_COMPLETE,
            "data": {
                "spec_id": spec.id,
                "steps": completed_steps,
                "trust_level": spec.trust_level,
                "successful_runs": spec.successful_runs,
            },
        }

    async def dry_run(
        self,
        spec_or_draft: dict,
        session: Optional[SessionRecord],
    ) -> list[dict]:
        """Resolve every step's expected value WITHOUT persisting or
        broadcasting. Used by /api/agents/preview to give HITLReplay the
        values to display before the real run.
        """
        steps = spec_or_draft.get("action_sequence") or []
        network_calls = list(session.network_calls or []) if session else []
        values: dict[str, dict] = {"step": {}}
        resolved: list[dict] = []
        for step_def in steps:
            step_num = step_def.get("step", 0)
            try:
                result = await self._execute_step(step_def, network_calls, values)
            except Exception as exc:
                result = {"value": "", "source_tag": f"error: {exc}", "confidence": 0.0}
            values["step"][str(step_num)] = result
            resolved.append({
                **step_def,
                "value": result.get("value", ""),
                "source_tag": result.get("source_tag", ""),
                "confidence": result.get("confidence", 0.5),
            })
        return resolved

    async def _execute_step(
        self,
        step: dict,
        network_calls: list[dict],
        values: dict,
    ) -> dict:
        """5-way dispatch on step action. No hardcoded field names anywhere."""
        action = (step.get("action") or "").lower()

        if action == "fetch":
            return self._fetch(step, network_calls)
        if action == "read":
            return self._read(step)
        if action == "write":
            return self._write(step, values)
        if action == "reason":
            return await self._reason(step, values)
        if action == "assert":
            return self._assert(step, values)

        return {
            "value": "",
            "source_tag": f"unknown action: {action}",
            "confidence": 0.0,
        }

    def _fetch(self, step: dict, network_calls: list[dict]) -> dict:
        """Replay a captured network call. The actual run-time fetch happens
        on the host page (so cookies/auth apply). For dry-run / preview, we
        return the response that was observed when the worker performed the
        same call during teach mode.
        """
        sf = step.get("source_fetch") or {}
        method = sf.get("method", "GET")
        url_template = sf.get("url_template", "")
        if not url_template:
            return {"value": "", "source_tag": "fetch missing url_template", "confidence": 0.3}

        match = find_matching_network_call(method, url_template, network_calls)
        if not match:
            return {
                "value": "",
                "source_tag": f"{method} {url_template} (no captured response)",
                "confidence": 0.4,
            }

        value = _extract_response_value(
            match.get("response_body"), sf.get("response_jsonpath")
        )
        return {
            "value": value,
            "source_tag": f"from {method} {url_template}",
            "confidence": 0.95,
        }

    def _read(self, step: dict) -> dict:
        """Backend cannot read the DOM. We surface the fingerprint so the host
        page (loader + element_resolver) can perform the actual read at run
        time and post the value back through the SSE bus.
        """
        fp = step.get("target_fingerprint") or {}
        name = fp.get("accessible_name", "")
        return {
            "value": "",  # filled in at run time by the host
            "source_tag": f"reads {name}" if name else "reads element",
            "confidence": 0.9,
        }

    def _write(self, step: dict, values: dict) -> dict:
        """Resolve value_template using prior step outputs."""
        template = step.get("value_template") or ""
        value = _interpolate(template, values)
        fp = step.get("target_fingerprint") or {}
        name = fp.get("accessible_name", "")
        return {
            "value": value,
            "source_tag": f"writes {name}" if name else "writes element",
            "confidence": 0.92,
        }

    async def _reason(self, step: dict, values: dict) -> dict:
        prompt_template = step.get("reasoning_prompt") or step.get("description") or ""
        prompt = _interpolate(prompt_template, values)
        if not prompt:
            return {"value": "", "source_tag": "reason missing prompt", "confidence": 0.3}
        try:
            text = await _reason_client.reason(prompt)
        except QuotaExhaustedException:
            raise
        except Exception as exc:
            return {"value": "", "source_tag": f"reason error: {exc}", "confidence": 0.2}
        return {
            "value": text,
            "source_tag": "from gemini-2.5-flash reasoning",
            "confidence": 0.85,
        }

    def _assert(self, step: dict, values: dict) -> dict:
        expression = step.get("value_template") or step.get("description") or ""
        ok = _evaluate_assertion(expression, values)
        return {
            "value": "true" if ok else "false",
            "source_tag": f"assertion: {expression}",
            "confidence": 0.95,
        }


narrow_agent = NarrowAgent()
