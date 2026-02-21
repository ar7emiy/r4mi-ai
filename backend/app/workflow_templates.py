from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FormField:
    id: str
    label: str
    field_type: str  # text | number | select | textarea
    options: list[str] = field(default_factory=list)
    placeholder: str = ""
    required: bool = True


@dataclass
class WorkflowTemplate:
    id: str
    name: str
    description: str
    case_file_description: str
    form_fields: list[FormField]
    extraction_hints: dict[str, str]  # field_id → where to find it in case file


BILLING_REFUND = WorkflowTemplate(
    id="billing_refund",
    name="Billing Refund Request",
    description="Process customer billing refund requests caused by disputed or erroneous charges.",
    case_file_description=(
        "Customer billing statement containing: account summary, current billing cycle breakdown, "
        "itemized charge detail table with potential overages, prior contact history log, "
        "policy reference section with eligibility rules and routing thresholds, "
        "and 12-month payment history."
    ),
    form_fields=[
        FormField("refund_amount", "Refund Amount ($)", "number", placeholder="0.00"),
        FormField("billing_period", "Billing Period", "text", placeholder="e.g. Oct 15 – Nov 14, 2024"),
        FormField(
            "eligibility_status",
            "Eligibility Status",
            "select",
            options=["eligible", "partially_eligible", "ineligible", "escalate_to_supervisor"],
        ),
        FormField(
            "routing_decision",
            "Routing Decision",
            "select",
            options=["auto_approve", "manual_review", "supervisor_approval", "deny_with_explanation"],
        ),
        FormField("agent_notes", "Agent Notes", "textarea", placeholder="Summary of case and decision rationale"),
    ],
    extraction_hints={
        "refund_amount": "Identify 'AMOUNT DUE' or 'Disputed Amount' in current cycle. Source: Table.CycleOverview",
        "billing_period": "Identify 'BILLING CYCLE' range. Source: Header.CycleDates",
        "eligibility_status": "Determine if 'ROOT CAUSE' in Contact Log matches 'System Error'. Source: Log.InternalReview",
        "routing_decision": "Compare refund_amount against $500 threshold in Policy 4.2b. Source: Policy.Thresholds",
        "agent_notes": "Synthesize decision: confirmed error, total amount, and policy adherence. Source: Multi",
    },
)

ACCOUNT_CANCELLATION = WorkflowTemplate(
    id="account_cancellation",
    name="Account Cancellation Processing",
    description="Process customer account cancellation requests including ETF calculation and waiver decisions.",
    case_file_description=(
        "Customer profile with: account tier and ARR, active contract terms with start/end dates, "
        "early termination fee schedule and calculation, 12-month payment history, "
        "churn indicator notes from contact log with prior retention offers, "
        "and policy section on ETF waiver conditions including tenure-based eligibility."
    ),
    form_fields=[
        FormField(
            "account_tier",
            "Account Tier",
            "select",
            options=["basic", "professional", "enterprise_pro", "premium_legacy"],
        ),
        FormField("remaining_contract_term", "Remaining Contract (months)", "number", placeholder="0"),
        FormField("early_termination_fee", "Early Termination Fee ($)", "number", placeholder="0.00"),
        FormField(
            "fee_waiver_applied",
            "Fee Waiver Applied",
            "select",
            options=["no_waiver", "partial_25pct", "partial_50pct", "full_waiver", "supervisor_discretion"],
        ),
        FormField(
            "offboarding_notes",
            "Offboarding Notes",
            "textarea",
            placeholder="Cancellation reason, retention attempts, final status",
        ),
    ],
    extraction_hints={
        "account_tier": "Find Tier field in Customer Profile section",
        "remaining_contract_term": "Calculate: contract end date minus today's date in months",
        "early_termination_fee": "Use ETF schedule table with 'APPLIES' marker for correct tier",
        "fee_waiver_applied": "Check policy 9.1 waiver conditions against tenure (>3yr = partial eligible)",
        "offboarding_notes": "Summarize churn reason from contact log + list all retention offers made",
    },
)

TEMPLATES: dict[str, WorkflowTemplate] = {
    "billing_refund": BILLING_REFUND,
    "account_cancellation": ACCOUNT_CANCELLATION,
}


def get_template(template_id: str) -> WorkflowTemplate | None:
    return TEMPLATES.get(template_id)


def list_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "field_count": len(t.form_fields),
        }
        for t in TEMPLATES.values()
    ]
