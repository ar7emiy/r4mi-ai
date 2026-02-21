const state = {
  sessionId: null,
  opportunityId: null,
  captureId: null,
  specId: null,
  moduleId: null,
};

const byId = (id) => document.getElementById(id);

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status} ${detail}`);
  }
  return res.json();
}

function renderMeta() {
  byId("sessionMeta").textContent = state.sessionId
    ? `Session: ${state.sessionId} | Opportunity: ${state.opportunityId || "none"}`
    : "No active session.";

  byId("captureMeta").textContent = state.captureId
    ? `Capture: ${state.captureId} | Spec: ${state.specId || "pending"}`
    : "No active capture.";
}

async function refreshState() {
  const data = await api("/api/state");
  byId("stateView").textContent = JSON.stringify(data, null, 2);
}

byId("startSessionBtn").addEventListener("click", async () => {
  const ticketType = byId("ticketType").value;
  const data = await api("/api/sessions", "POST", { ticket_type: ticketType });
  state.sessionId = data.session.id;
  state.opportunityId = null;
  state.captureId = null;
  state.specId = null;
  state.moduleId = null;
  renderMeta();
  await refreshState();
});

byId("pushSampleEventsBtn").addEventListener("click", async () => {
  if (!state.sessionId) {
    alert("Start a session first.");
    return;
  }

  const events = [
    { app: "crm", action: "open_ticket", details: "billing dispute tagged" },
    { app: "crm", action: "verify_identity", details: "matched last invoice" },
    { app: "billing_admin", action: "lookup_subscription", details: "plan=pro monthly" },
    { app: "knowledge_base", action: "open_policy", details: "refund eligibility policy" },
    { app: "web_search", action: "query", details: "chargeback grace period" },
    { app: "billing_admin", action: "submit_refund", details: "partial refund" },
  ];

  for (const event of events) {
    await api(`/api/sessions/${state.sessionId}/events`, "POST", event);
  }
  await refreshState();
});

byId("detectBtn").addEventListener("click", async () => {
  if (!state.sessionId) {
    alert("Start a session first.");
    return;
  }
  const data = await api(`/api/sessions/${state.sessionId}/detect`, "POST");
  state.opportunityId = data.opportunity.id;
  renderMeta();
  await refreshState();
});

byId("startCaptureBtn").addEventListener("click", async () => {
  if (!state.opportunityId) {
    alert("Detect an opportunity first.");
    return;
  }
  const data = await api("/api/captures/start", "POST", { opportunity_id: state.opportunityId });
  state.captureId = data.capture.id;
  renderMeta();
  await refreshState();
});

byId("recordStepBtn").addEventListener("click", async () => {
  if (!state.captureId) {
    alert("Start capture first.");
    return;
  }
  const payload = {
    action: byId("stepAction").value,
    target: byId("stepTarget").value,
    notes: byId("stepNotes").value,
  };
  await api(`/api/captures/${state.captureId}/events`, "POST", payload);
  await refreshState();
});

byId("closeCaptureBtn").addEventListener("click", async () => {
  if (!state.captureId) {
    alert("Start capture first.");
    return;
  }
  const data = await api("/api/captures/close", "POST", { capture_id: state.captureId });
  state.specId = data.spec.id;
  renderMeta();
  await refreshState();
});

byId("approveSpecBtn").addEventListener("click", async () => {
  if (!state.specId) {
    alert("Generate spec first.");
    return;
  }
  await api("/api/specs/approve", "POST", { spec_id: state.specId });
  await refreshState();
});

byId("buildModuleBtn").addEventListener("click", async () => {
  if (!state.specId) {
    alert("Approve spec first.");
    return;
  }
  const data = await api("/api/modules/build", "POST", { spec_id: state.specId });
  state.moduleId = data.module.id;
  await refreshState();
});

byId("testModuleBtn").addEventListener("click", async () => {
  if (!state.moduleId) {
    alert("Build module first.");
    return;
  }
  await api("/api/modules/test", "POST", { module_id: state.moduleId });
  await refreshState();
});

byId("tuneModuleBtn").addEventListener("click", async () => {
  if (!state.moduleId) {
    alert("Build module first.");
    return;
  }
  await api("/api/modules/tune", "POST", {
    module_id: state.moduleId,
    feedback: byId("feedbackInput").value,
  });
  await refreshState();
});

byId("promoteModuleBtn").addEventListener("click", async () => {
  if (!state.moduleId) {
    alert("Build module first.");
    return;
  }
  await api("/api/modules/promote", "POST", { module_id: state.moduleId });
  await refreshState();
});

byId("refreshStateBtn").addEventListener("click", refreshState);

renderMeta();
refreshState().catch((err) => {
  byId("stateView").textContent = `API not reachable yet: ${err.message}`;
});
