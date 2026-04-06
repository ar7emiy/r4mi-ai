import { useState, useEffect, useRef, useCallback } from 'react'
import { AgentverseDrawer } from './components/AgentverseDrawer'
import { HITLReplay } from './components/HITLReplay'
import { ChatInput } from './components/ChatInput'
import { ChatMessage as ChatMessageComponent } from './components/ChatMessage'
import { useChatMessages } from './hooks/useChatMessages'

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'recording' | 'detected' | 'replay' | 'publishing' | 'agents'

interface LogEntry {
  id: string
  text: string
  ts: number
  level: 'info' | 'success' | 'warn' | 'error'
}

interface DetectedData {
  session_id: string
  permit_type: string
  match_count: number
  scores?: Array<{ session: string; score: number }>
}

interface SpecData {
  id?: string
  name: string
  description: string
  permit_type: string
  action_sequence: Array<{
    step: number
    action: string
    description: string
    field: string
    value?: string
    source: string
  }>
  knowledge_sources: Array<{
    type: string
    name: string
    reference: string
    confidence: number
  }>
}

interface CaptureFeedback {
  narration: string | null
  lastAction: string | null
  stepCount: number
}

export const CLR = { bg: 'var(--clr-bg)', surface: 'var(--clr-surface)', border: 'var(--clr-border)', text: 'var(--clr-text)', dim: 'var(--clr-dim)', accent: 'var(--clr-accent)', green: 'var(--clr-green)', amber: 'var(--clr-amber)', red: 'var(--clr-red)' };
// ── API ──
const API_BASE =
  new URLSearchParams(window.location.search).get('api') ||
  'http://localhost:8000'

// ── Component ─────────────────────────────────────────────────────────────────
export function SidebarApp() {
  const [phase, setPhase] = useState<Phase>('idle')

  const [isDark, setIsDark] = useState(true)
  const [tab, setTab] = useState<'chat' | 'activity'>('chat')
  const [captureLogs, setCaptureLogs] = useState<Array<any>>([])
  const [isRecordingPaused, setIsRecordingPaused] = useState(localStorage.getItem('r4mi_pause_recording') === 'true')

  const toggleRecordingPause = () => {
    const next = !isRecordingPaused
    setIsRecordingPaused(next)
    if (next) localStorage.setItem('r4mi_pause_recording', 'true')
    else localStorage.removeItem('r4mi_pause_recording')
  }


  useEffect(() => {
    const clrs = isDark ? {
      '--clr-bg': '#09090b',
      '--clr-surface': '#18181b',
      '--clr-border': '#27272a',
      '--clr-text': '#f4f4f5',
      '--clr-dim': '#a1a1aa',
      '--clr-accent': '#FF7E67',
      '--clr-green': '#10b981',
      '--clr-amber': '#f59e0b',
      '--clr-red': '#ef4444',
    } : {
      '--clr-bg': '#f8fafc',
      '--clr-surface': '#ffffff',
      '--clr-border': '#e2e8f0',
      '--clr-text': '#0f172a',
      '--clr-dim': '#64748b',
      '--clr-accent': '#FF7E67',
      '--clr-green': '#059669',
      '--clr-amber': '#d97706',
      '--clr-red': '#dc2626',
    };
    for (const [k, v] of Object.entries(clrs)) {
      document.body.style.setProperty(k, v);
    }
  }, [isDark]);
  const { messages, addMessage } = useChatMessages()
  const [detected, setDetected] = useState<DetectedData | null>(null)
  const [spec, setSpec] = useState<SpecData | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedName, setPublishedName] = useState<string | null>(null)
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [recording, setRecording] = useState({
    active: false,
    sessionId: null as string | null,
    feedback: { narration: null, lastAction: null, stepCount: 0 } as CaptureFeedback,
  })

  const logsEndRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const log = useCallback((text: string, level: LogEntry['level'] = 'info') => {
    const type = level === 'success' ? 'system' : level === 'error' ? 'error' : 'system'
    addMessage(type, text)
  }, [addMessage])

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── SSE ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null

    function connect() {
      es = new EventSource(`${API_BASE}/api/sse`)
      es.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data)
          const event = raw.event as string
          const payload = (raw.data ?? raw) as Record<string, unknown>

          if (event === 'OPTIMIZATION_OPPORTUNITY') {
            const d: DetectedData = {
              session_id: payload.session_id as string,
              permit_type: payload.permit_type as string ?? 'unknown',
              match_count: payload.match_count as number ?? 3,
              scores: payload.scores as DetectedData['scores'],
            }
            setDetected(d)
            if (phaseRef.current === 'idle') {
              setPhase('detected')
            }
            log(`pattern detected: ${d.permit_type} (${d.match_count} matches)`, 'success')
          }

          if (event === 'AGENT_DEMO_STEP') {
            // Handled by HITLReplay via its own SSE or postMessage
          }

          if (event === 'AGENT_PUBLISHED') {
            log(`agent published: ${payload.name}`, 'success')
          }

          if (event === 'AGENT_RUN_COMPLETE') {
            log(`run complete. ${payload.fields_processed ?? 0} fields filled.`, 'success')
          }

          if (event === 'AGENT_EXCEPTION') {
            log(`error: ${payload.reason ?? 'unknown'}`, 'error')
          }
        } catch { /* ignore */ }
      }
      es.onerror = () => {
        es?.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => { es?.close() }
  }, [log])

  // ── PostMessage from parent (loader) ─────────────────────────────────────
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data?.type) return
      if (e.data.type === 'r4mi:automation-alert') {

        addMessage('notification', 'Guided auto-fill is available.')
        addMessage('spec', 'Utility: Data entry automation\nGoals: Save time\nInput: Page context\nOutput: Filled forms', {})
        setTimeout(() => {
          addMessage('system', 'Next: show each step? Do you have questions?')
        }, 500)
      }
      if (e.data.type === 'r4mi:opened') {
        if (e.data.activeApplicationId) {
          setActiveAppId(e.data.activeApplicationId)
        }
      }
      if (e.data.type === 'r4mi:source-confirmed') {
        log(`source confirmed: ${e.data.section || 'selected paragraph'}`, 'success')
      }
      if (e.data.type === 'r4mi:capture-live') {
        const d = e.data.detail as { type: string; text?: string; label?: string; screen?: string; role?: string, position?: { x: number, y: number } };
        if (d.type === 'action' || d.type === 'narration' || d.type === 'screenshot') {
          setCaptureLogs(prev => [...prev, { id: Date.now() + Math.random(), ts: Date.now(), ...d }]);
        }
        setRecording((prev) => ({

          ...prev,
          feedback: {
            narration: d.type === 'narration' ? (d.text ?? prev.feedback.narration) : prev.feedback.narration,
            lastAction: d.type === 'action' ? `${d.label || d.role} on ${d.screen}` : prev.feedback.lastAction,
            stepCount: d.type === 'action' ? prev.feedback.stepCount + 1 : prev.feedback.stepCount,
          },
        }))
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [log])

  // ── Actions ──────────────────────────────────────────────────────────────
  function startRecording() {
    const sessionId = `teach-${Date.now()}`
    setRecording({
      active: true,
      sessionId,
      feedback: { narration: null, lastAction: null, stepCount: 0 },
    })
    setPhase('recording')
    window.parent.postMessage(
      { type: 'r4mi:set-session', sessionId, permitType: '' },
      '*',
    )
    log('recording started. work through the workflow.')
  }

  function stopRecording() {
    const sessionId = recording.sessionId
    if (sessionId) {
      fetch(`${API_BASE}/api/observe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: 'permit-tech-001',
          timestamp: new Date().toISOString(),
          event_type: 'submit',
          screen_name: 'TEACH_MODE_COMPLETE',
          element_selector: 'teach-stop-button',
        }),
      }).catch(() => { })
    }
    setRecording((prev) => ({ ...prev, active: false }))
    window.parent.postMessage({ type: 'r4mi:set-session', sessionId: '' }, '*')
    log('recording stopped. processing...')
    // Will transition to 'detected' when SSE fires OPTIMIZATION_OPPORTUNITY
    setPhase('idle')
  }

  async function buildSpec() {
    if (!detected) return
    setIsBuilding(true)
    log('building agent spec from pattern...')
    try {
      const res = await fetch(`${API_BASE}/api/agents/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: detected.session_id }),
      })
      const result = await res.json()
      if (result.spec) {
        setSpec(result.spec as SpecData)
        setPhase('replay')
        log(`spec ready: ${result.spec.name}`, 'success')
      } else {
        log('spec build failed', 'error')
      }
    } catch (e) {
      log(`build error: ${e}`, 'error')
    } finally {
      setIsBuilding(false)
    }
  }

  async function rebuildSpec(correction: string) {
    if (!detected) return
    setIsBuilding(true)
    log(`applying correction: "${correction.slice(0, 50)}..."`)
    try {
      const res = await fetch(`${API_BASE}/api/agents/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: detected.session_id, correction }),
      })
      const result = await res.json()
      if (result.spec) {
        setSpec(result.spec as SpecData)
        log('spec updated with correction', 'success')
      }
    } catch (e) {
      log(`rebuild error: ${e}`, 'error')
    } finally {
      setIsBuilding(false)
    }
  }

  async function publishAgent() {
    if (!detected) return
    setIsPublishing(true)
    log('publishing agent to agentverse...')
    try {
      const res = await fetch(`${API_BASE}/api/agents/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: detected.session_id }),
      })
      const published = await res.json()
      setPublishedName(published.name || 'unnamed')
      setPhase('publishing')
      log(`published: ${published.name}`, 'success')
    } catch (e) {
      log(`publish error: ${e}`, 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  function runAgent(specId: string, specName: string) {
    window.parent.postMessage(
      { type: 'r4mi:run-agent', specId, applicationId: activeAppId },
      '*',
    )
    log(`running ${specName} on ${activeAppId || 'current app'}...`)
    setPhase('idle')
  }

  function resetToIdle() {
    setPhase('idle')
    setDetected(null)
    setSpec(null)
    setPublishedName(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'agents') {
    return (
      <AgentverseDrawer
        onClose={() => setPhase('idle')}
        activeApplicationId={activeAppId}
        onRun={runAgent}
      />
    )
  }

  return (
    <div style={root}>

      {/* Header */}
      <div style={header}>
        <span style={headerTitle}>r4mi</span>
        <span style={headerPhase}>
          {isRecordingPaused ? <span style={{ color: CLR.red }}>■ Paused Mode</span> : <span style={{ color: CLR.green }}>● Passive Mode</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={toggleRecordingPause} style={{ ...headerBtn, color: isRecordingPaused ? CLR.red : CLR.green, borderColor: isRecordingPaused ? CLR.red : CLR.green }} title="Pause all recording">
            {isRecordingPaused ? 'off' : 'on'}
          </button>
          <button onClick={() => setIsDark(!isDark)} style={headerBtn}>{isDark ? '☀️' : '🌙'}</button>
          <button onClick={() => setPhase('agents')} style={headerBtn}>agents</button>
          <button
            onClick={() => window.parent.postMessage({ type: 'r4mi:close' }, '*')}
            style={headerBtn}
          >x</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${CLR.border}`, background: CLR.surface }}>
        <div onClick={() => setTab('chat')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', fontSize: 11, fontWeight: tab === 'chat' ? 700 : 400, color: tab === 'chat' ? CLR.accent : CLR.dim, borderBottom: tab === 'chat' ? `2px solid ${CLR.accent}` : '2px solid transparent' }}>Chat</div>
        <div onClick={() => setTab('activity')} style={{ flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', fontSize: 11, fontWeight: tab === 'activity' ? 700 : 400, color: tab === 'activity' ? CLR.accent : CLR.dim, borderBottom: tab === 'activity' ? `2px solid ${CLR.accent}` : '2px solid transparent' }}>System View</div>
      </div>



      {/* Main content area */}
      {tab === 'activity' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: CLR.bg }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: CLR.accent, marginBottom: 8, textTransform: 'uppercase' }}>── System Telemetry & Insights ──</div>
          <div style={{ fontSize: 11, color: CLR.dim, marginBottom: 12 }}>Real-time streaming of LLM actions, DOM activity, and tracking.</div>

          {captureLogs.length === 0 && <div style={{ color: CLR.dim, fontSize: 11 }}>No activity captured yet. Start recording to see telemetry.</div>}

          {captureLogs.map((log) => (
            <div key={log.id} style={{ padding: '8px 12px', background: CLR.surface, border: `1px solid ${CLR.border}`, borderRadius: 4, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ color: CLR.dim, fontSize: 10, paddingTop: 2, minWidth: 60 }}>{new Date(log.ts).toISOString().split('T')[1].slice(0, 8)}</div>
              <div style={{ flex: 1 }}>
                {log.type === 'action' && (
                  <>
                    <span style={{ color: CLR.accent, fontWeight: 600, fontSize: 11 }}>[DOM_CLICK]</span>
                    <span style={{ color: CLR.text, fontSize: 11, marginLeft: 6 }}>{log.role?.toUpperCase()} {log.label ? `"${log.label}"` : ''} on {log.screen}</span>
                    {log.position && <div style={{ color: CLR.dim, fontSize: 10, marginTop: 4 }}>► pixel coordinates: x={log.position.x}, y={log.position.y}</div>}
                  </>
                )}
                {log.type === 'narration' && (
                  <>
                    <span style={{ color: CLR.green, fontWeight: 600, fontSize: 11 }}>[VOICE_INPUT]</span>
                    <span style={{ color: CLR.text, fontSize: 11, marginLeft: 6, fontStyle: 'italic' }}>"{log.text}"</span>
                  </>
                )}
                {log.type === 'screenshot' && (
                  <>
                    <span style={{ color: CLR.amber, fontWeight: 600, fontSize: 11 }}>[SCREEN_CAPTURE]</span>
                    <span style={{ color: CLR.dim, fontSize: 11, marginLeft: 6 }}>Snapshot saved to trace memory</span>
                  </>
                )}
              </div>
            </div>
          ))}
          {/* Also show system chat messages */}
          {messages.filter(m => m.type === 'system' || m.type === 'spec').map((m) => (
            <div key={m.id} style={{ padding: '8px 12px', background: CLR.bg, borderLeft: `2px solid ${CLR.accent}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ color: CLR.dim, fontSize: 10, paddingTop: 2, minWidth: 60 }}>{new Date(m.timestamp).toISOString().split('T')[1].slice(0, 8)}</div>
              <div style={{ flex: 1 }}>
                <span style={{ color: CLR.amber, fontWeight: 600, fontSize: 11 }}>[LLM_THOUGHT]</span>
                <div style={{ color: CLR.text, fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      ) : (
        <div style={mainArea}>


          {/* ── IDLE ──────────────────────────────────────────── */}
          {phase === 'idle' && (
            <div style={phaseContainer}>
              <div style={logArea}>

                {tab === 'chat' ? messages.filter(m => m.type !== 'system' && m.type !== 'notification' && m.type !== 'error' && m.type !== 'agent-step').map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                )) : messages.map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                ))}

                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* ── RECORDING ─────────────────────────────────────── */}
          {phase === 'recording' && (
            <div style={phaseContainer}>
              <div style={sectionLabel}>── teach mode ──</div>
              <div style={{ padding: '8px 0' }}>
                <div style={kvRow}>
                  <span style={kvKey}>voice:</span>
                  <span style={recording.feedback.narration ? kvVal : kvDim}>
                    {recording.feedback.narration ?? 'listening...'}
                  </span>
                </div>
                <div style={kvRow}>
                  <span style={kvKey}>last:</span>
                  <span style={recording.feedback.lastAction ? kvVal : kvDim}>
                    {recording.feedback.lastAction ?? '—'}
                  </span>
                </div>
                <div style={kvRow}>
                  <span style={kvKey}>steps:</span>
                  <span style={kvVal}>{recording.feedback.stepCount} captured</span>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button onClick={stopRecording} style={btnDanger}>
                  ■ stop recording
                </button>
              </div>
              <div style={{ ...logArea, marginTop: 16 }}>

                {tab === 'chat' ? messages.filter(m => m.type !== 'system' && m.type !== 'notification' && m.type !== 'error' && m.type !== 'agent-step').map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                )) : messages.map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                ))}

                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* ── DETECTED ──────────────────────────────────────── */}
          {phase === 'detected' && detected && (
            <div style={phaseContainer}>
              <div style={sectionLabel}>── pattern detected ──</div>
              <div style={{ padding: '8px 0' }}>
                <div style={kvRow}>
                  <span style={kvKey}>permit_type:</span>
                  <span style={kvVal}>{detected.permit_type}</span>
                </div>
                <div style={kvRow}>
                  <span style={kvKey}>sessions:</span>
                  <span style={kvVal}>{detected.match_count} matched</span>
                </div>
                {detected.scores?.map((s, i) => (
                  <div key={i} style={kvRow}>
                    <span style={kvKey}>&gt;</span>
                    <span style={kvVal}>
                      {s.session} cos={s.score.toFixed(2)}{' '}
                      <span style={{ color: s.score >= 0.85 ? CLR.green : CLR.dim }}>
                        {s.score >= 0.85 ? '✓' : '✗'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ ...kvVal, margin: '8px 0 12px', lineHeight: 1.5 }}>
                r4mi can automate this workflow.{'\n'}
                review the replay to approve each step.
              </div>
              <button
                onClick={buildSpec}
                disabled={isBuilding}
                style={isBuilding ? { ...btnPrimary, opacity: 0.5 } : btnPrimary}
              >
                {isBuilding ? 'building...' : '▶ review replay'}
              </button>
              <div style={{ ...logArea, marginTop: 16 }}>

                {tab === 'chat' ? messages.filter(m => m.type !== 'system' && m.type !== 'notification' && m.type !== 'error' && m.type !== 'agent-step').map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                )) : messages.map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                ))}

                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* ── REPLAY (HITL) ─────────────────────────────────── */}
          {phase === 'replay' && spec && detected && (
            <HITLReplay
              spec={spec}
              sessionId={detected.session_id}
              applicationId={activeAppId || 'PRM-2024-0041'}
              onPublish={publishAgent}
              onCorrection={rebuildSpec}
              isPublishing={isPublishing}
              isRebuilding={isBuilding}
            />
          )}

          {/* ── PUBLISHED ─────────────────────────────────────── */}
          {phase === 'publishing' && (
            <div style={phaseContainer}>
              <div style={sectionLabel}>── published ──</div>
              <div style={{ padding: '12px 0' }}>
                <div style={{ color: CLR.green, marginBottom: 8 }}>
                  ✓ agent &quot;{publishedName}&quot; is live in agentverse.
                </div>
                <div style={kvVal}>
                  run it from the agents panel or type{' '}
                  <span style={{ color: CLR.accent }}>/agent-name app-id</span>{' '}
                  in any chat.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setPhase('agents')} style={btnPrimary}>
                  open agents
                </button>
                <button onClick={resetToIdle} style={btnGhost}>
                  back
                </button>
              </div>
              <div style={{ ...logArea, marginTop: 16 }}>

                {tab === 'chat' ? messages.filter(m => m.type !== 'system' && m.type !== 'notification' && m.type !== 'error' && m.type !== 'agent-step').map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                )) : messages.map((m) => (
                  <ChatMessageComponent key={m.id} msg={m} />
                ))}

                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer — teach me + command input */}
      {tab === 'chat' && (
        <ChatInput addMessage={addMessage} isRecording={recording.active} setIsRecording={() => phase === 'recording' ? stopRecording() : startRecording()} onToggleAgentverse={() => setPhase('agents')} />
      )}
      {tab === 'activity' && (
        <div style={{ borderTop: `1px solid ${CLR.border}`, padding: 8, background: CLR.bg }}></div>
      )}
    </div>

  )
}

// ── LogLine ─────────────────────────────────────────────────────────────────

// ── Styles ──────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace"



const root: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: CLR.bg,
  fontFamily: MONO,
  color: CLR.text,
  fontSize: 12,
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderBottom: `1px solid ${CLR.border}`,
  flexShrink: 0,
}

const headerTitle: React.CSSProperties = {
  color: CLR.accent,
  fontWeight: 700,
  fontSize: 13,
}

const headerPhase: React.CSSProperties = {
  color: CLR.dim,
  fontSize: 11,
  flex: 1,
}

const headerBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${CLR.border}`,
  color: CLR.dim,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: MONO,
  borderRadius: 2,
}

const mainArea: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
}

const phaseContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const sectionLabel: React.CSSProperties = {
  color: CLR.accent,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const kvRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 2,
  fontSize: 12,
  lineHeight: 1.6,
}

const kvKey: React.CSSProperties = {
  color: CLR.dim,
  minWidth: 90,
  flexShrink: 0,
}

const kvVal: React.CSSProperties = {
  color: CLR.text,
  whiteSpace: 'pre-wrap',
}

const kvDim: React.CSSProperties = {
  color: CLR.dim,
  fontStyle: 'italic',
}

const logArea: React.CSSProperties = {
  borderTop: `1px solid ${CLR.border}`,
  paddingTop: 8,
}


const btnPrimary: React.CSSProperties = {
  background: CLR.accent,
  border: 'none',
  color: '#fff',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: MONO,
  borderRadius: 2,
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${CLR.border}`,
  color: CLR.dim,
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: MONO,
  borderRadius: 2,
}

const btnDanger: React.CSSProperties = {
  background: 'rgba(248, 81, 73, 0.1)',
  border: `1px solid ${CLR.red}`,
  color: CLR.red,
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: MONO,
  borderRadius: 2,
}
