import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ElementFingerprint {
  role: string
  accessible_name: string
  landmark?: string
  surrounding_text?: string
  position_signature?: string
  url_pattern?: string
}

interface SourceFetch {
  method: string
  url_template: string
  expected_status?: number
  response_jsonpath?: string
}

interface ResolvedStep {
  step: number
  // Site-agnostic 5-action vocabulary: read | fetch | reason | write | assert
  action: string
  description: string
  value: string
  source_tag: string
  confidence: number
  target_fingerprint?: ElementFingerprint | null
  source_fetch?: SourceFetch | null
}

interface SpecData {
  name: string
  description: string
  // cluster_label replaces permit_type — discovered post-hoc by cluster_service
  cluster_id?: string | null
  cluster_label?: string | null
  permit_type?: string  // legacy
  action_sequence: Array<{
    step: number
    action: string
    description: string
    target_fingerprint?: ElementFingerprint | null
    source_fetch?: SourceFetch | null
    value_template?: string
  }>
  knowledge_sources: Array<{
    type: string
    name: string
    reference: string
    confidence: number
  }>
}

interface PreviewResponse {
  spec_name: string
  spec_description: string
  cluster_id?: string | null
  cluster_label?: string | null
  permit_type?: string  // legacy
  steps: ResolvedStep[]
  knowledge_sources: Array<{
    type: string
    name: string
    reference: string
    confidence: number
  }>
}

interface Props {
  spec: SpecData
  sessionId: string
  applicationId: string
  onPublish: () => void
  onCorrection: (correction: string) => void
  isPublishing: boolean
  isRebuilding: boolean
}

const API_BASE =
  new URLSearchParams(window.location.search).get('api') ||
  'http://localhost:8000'

// Step-screen labels are now derived from the step's own context — either
// the source_fetch URL (for FETCH steps) or the target fingerprint's
// landmark/accessible-name (for READ/WRITE/ASSERT steps). No hardcoded
// permit-domain mapping.
function describeStepTarget(step: ResolvedStep): string {
  if (step.source_fetch && step.source_fetch.url_template) {
    return `${step.source_fetch.method} ${step.source_fetch.url_template}`
  }
  if (step.target_fingerprint && step.target_fingerprint.accessible_name) {
    const name = step.target_fingerprint.accessible_name
    const role = step.target_fingerprint.role || 'element'
    return `${role}: ${name}`
  }
  return step.action.toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────
export function HITLReplay({ spec, sessionId, applicationId, onPublish, onCorrection, isPublishing, isRebuilding }: Props) {
  const [resolvedSteps, setResolvedSteps] = useState<ResolvedStep[]>([])
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(-1) // -1 = not started
  const [stepStatus, setStepStatus] = useState<Array<'pending' | 'navigating' | 'filling' | 'waiting' | 'approved' | 'corrected'>>([])
  const [corrections, setCorrections] = useState<Record<number, string>>({})
  const [correctionInput, setCorrectionInput] = useState('')
  const [showCorrectionBox, setShowCorrectionBox] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stepRef = useRef(currentStep)
  stepRef.current = currentStep

  // Fetch resolved step values on mount
  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`${API_BASE}/api/agents/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, application_id: applicationId }),
        })
        if (!res.ok) {
          throw new Error(`Preview failed: ${res.status}`)
        }
        const data: PreviewResponse = await res.json()
        setResolvedSteps(data.steps)
        setStepStatus(data.steps.map(() => 'pending'))
        setLoading(false)
        setCurrentStep(-1)
      } catch (e) {
        setError(`${e}`)
        setLoading(false)
      }
    }
    fetchPreview()
  }, [sessionId, applicationId])

  // Drive host page when step changes
  useEffect(() => {
    if (currentStep < 0 || currentStep >= resolvedSteps.length) {
      if (currentStep >= resolvedSteps.length && resolvedSteps.length > 0) {
        setAllDone(true)
      }
      return
    }

    const step = resolvedSteps[currentStep]

    // Phase 1: Navigate to the right tab
    setStepStatus((prev) => {
      const next = [...prev]
      next[currentStep] = 'navigating'
      return next
    })

    // Tab navigation is hint-only: derive a friendly tab name from the
    // step's URL pattern when available, else from the target landmark.
    // Hosts that listen for `r4mi:navigate-tab` can switch to that tab; if
    // they don't, the resolver still finds the target across the current
    // DOM.
    const tabHint =
      step.source_fetch?.url_template ||
      step.target_fingerprint?.landmark ||
      step.action
    window.parent.postMessage({ type: 'r4mi:navigate-tab', tab: tabHint }, '*')

    // Phase 2: After a short delay for tab animation, drive the host page
    const navTimer = setTimeout(() => {
      setStepStatus((prev) => {
        const next = [...prev]
        next[stepRef.current] = 'filling'
        return next
      })

      // Send the resolved step to r4mi-loader. The loader uses
      // element_resolver.js to find the DOM target by fingerprint and
      // animates the value in (or replays the captured fetch for FETCH
      // steps).
      if (step.value || step.target_fingerprint || step.source_fetch) {
        window.parent.postMessage(
          {
            type: 'r4mi:demo-step',
            step: {
              action: step.action,
              value: step.value,
              source_tag: step.source_tag,
              target_fingerprint: step.target_fingerprint,
              source_fetch: step.source_fetch,
              description: step.description,
            },
          },
          '*',
        )
      }

      // Phase 3: After fill animation, wait for user approval
      const fillTimer = setTimeout(() => {
        setStepStatus((prev) => {
          const next = [...prev]
          next[stepRef.current] = 'waiting'
          return next
        })
      }, step.value ? 800 : 300) // longer delay if actually filling a field

      return () => clearTimeout(fillTimer)
    }, 600) // time for tab switch animation

    return () => clearTimeout(navTimer)
  }, [currentStep, resolvedSteps])

  function approveStep() {
    setStepStatus((prev) => {
      const next = [...prev]
      next[currentStep] = 'approved'
      return next
    })
    setShowCorrectionBox(false)
    setCorrectionInput('')
    setCurrentStep((prev) => prev + 1)
  }

  function submitCorrection() {
    const text = correctionInput.trim()
    if (!text) return
    setCorrections((prev) => ({ ...prev, [currentStep]: text }))
    setStepStatus((prev) => {
      const next = [...prev]
      next[currentStep] = 'corrected'
      return next
    })
    setShowCorrectionBox(false)
    setCorrectionInput('')
    setCurrentStep((prev) => prev + 1)
  }

  function handlePublish() {
    const allCorrections = Object.entries(corrections)
      .map(([stepIdx, text]) => `Step ${Number(stepIdx) + 1}: ${text}`)
      .join('. ')

    if (allCorrections) {
      onCorrection(allCorrections)
    } else {
      onPublish()
    }
  }

  function replayAgain() {
    setCurrentStep(0)
    setStepStatus(resolvedSteps.map(() => 'pending'))
    setCorrections({})
    setAllDone(false)
    setShowCorrectionBox(false)
    setCorrectionInput('')
  }

  if (loading) {
    return (
      <div style={container}>
        <div style={sectionLabel}>── replay ──</div>
        <div style={{ color: CLR.dim, padding: '12px 0' }}>resolving step values...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={container}>
        <div style={sectionLabel}>── replay ──</div>
        <div style={{ color: CLR.red, padding: '12px 0' }}>{error}</div>
      </div>
    )
  }

  const activeStep = currentStep >= 0 && currentStep < resolvedSteps.length ? resolvedSteps[currentStep] : null
  const activeStatus = activeStep ? stepStatus[currentStep] : null
  const isWaiting = activeStatus === 'waiting'

  return (
    <div style={container}>
      <div style={sectionLabel}>── replay ──</div>

      {/* Spec header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: CLR.text, fontWeight: 600, marginBottom: 2 }}>{spec.name}</div>
        <div style={{ color: CLR.dim, fontSize: 11 }}>{spec.description}</div>
      </div>

      {/* Step list */}
      <div style={{ marginBottom: 12 }}>
        {resolvedSteps.map((s, i) => {
          const status = stepStatus[i]
          const isCurrent = i === currentStep && !allDone
          const statusIcon =
            status === 'approved' ? '✓' :
              status === 'corrected' ? '~' :
                status === 'navigating' ? '◎' :
                  status === 'filling' ? '◉' :
                    status === 'waiting' ? '▸' :
                      ' '
          const statusColor =
            status === 'approved' ? CLR.green :
              status === 'corrected' ? CLR.amber :
                (status === 'navigating' || status === 'filling') ? CLR.accent :
                  isCurrent ? CLR.accent : CLR.dim

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 6,
                padding: '4px 6px',
                opacity: i > currentStep && !allDone ? 0.3 : 1,
                background: isCurrent ? 'rgba(124, 107, 245, 0.06)' : 'transparent',
                borderLeft: isCurrent ? `2px solid ${CLR.accent}` : '2px solid transparent',
              }}
            >
              <span style={{ color: statusColor, fontWeight: 700, fontSize: 11, width: 14, flexShrink: 0 }}>
                {statusIcon}
              </span>
              <span style={{ color: CLR.dim, fontSize: 11, width: 16, flexShrink: 0 }}>{s.step}.</span>
              <div style={{ flex: 1 }}>
                <span style={{ color: CLR.text, fontSize: 11 }}>
                  {s.description || s.action}
                </span>
                {s.value && status !== 'pending' && (
                  <span style={{ color: CLR.green, fontSize: 10, marginLeft: 6 }}>
                    = {s.value}
                  </span>
                )}
                {s.source_tag && status !== 'pending' && (
                  <span style={{
                    color: CLR.dim, fontSize: 10, marginLeft: 6,
                    background: CLR.surface, border: `1px solid ${CLR.border}`,
                    padding: '0 4px', borderRadius: 2,
                  }}>
                    {s.source_tag}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Active step detail */}
      {currentStep === -1 && !allDone && (
        <div style={activePanel}>
          <div style={sectionLabel}>── ready ──</div>
          <div style={{ color: CLR.dim, fontSize: 11, marginBottom: 8 }}>
            The agent is built and ready to replay the workflow. Ensure you have an appropriate, unsubmitted record open in the host application before beginning!
          </div>
          <button onClick={() => setCurrentStep(0)} style={btnPrimary}>
            ▶ begin replay
          </button>
        </div>
      )}
      {activeStep && !allDone && currentStep >= 0 && (
        <div style={activePanel}>
          <div style={sectionLabel}>
            ── step {activeStep.step}/{resolvedSteps.length} ──
          </div>

          {/* Navigation status */}
          {activeStatus === 'navigating' && (
            <div style={{ color: CLR.accent, fontSize: 11, margin: '6px 0' }}>
              locating {describeStepTarget(activeStep)}...
            </div>
          )}

          {/* Filling status */}
          {activeStatus === 'filling' && (
            <div style={{ color: CLR.accent, fontSize: 11, margin: '6px 0' }}>
              {activeStep.action === 'fetch'
                ? `replaying ${activeStep.source_fetch?.url_template || 'fetch'}...`
                : activeStep.action === 'reason'
                ? `reasoning...`
                : activeStep.value
                ? `${activeStep.action}: ${activeStep.target_fingerprint?.accessible_name || 'element'}...`
                : `${activeStep.action}...`}
            </div>
          )}

          {/* Waiting for approval — show full details */}
          {isWaiting && (
            <>
              <div style={{ padding: '4px 0' }}>
                <div style={kvRow}><span style={kvKey}>action:</span><span style={kvVal}>{activeStep.action}</span></div>
                <div style={kvRow}><span style={kvKey}>target:</span><span style={kvVal}>{describeStepTarget(activeStep)}</span></div>
                <div style={kvRow}>
                  <span style={kvKey}>value:</span>
                  <span style={{ color: CLR.green, fontWeight: 600 }}>{activeStep.value || '—'}</span>
                </div>
                <div style={kvRow}><span style={kvKey}>source:</span><span style={kvVal}>{activeStep.source_tag}</span></div>
              </div>

              <div style={{ color: CLR.dim, fontSize: 10, margin: '6px 0' }}>
                look at the host page — does this look right?
              </div>

              {showCorrectionBox ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ color: CLR.dim, fontSize: 10, marginBottom: 4 }}>what should change?</div>
                  <textarea
                    value={correctionInput}
                    onChange={(e) => setCorrectionInput(e.target.value)}
                    placeholder="describe the correction..."
                    rows={2}
                    style={textareaStyle}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button
                      onClick={submitCorrection}
                      disabled={correctionInput.trim().length < 3}
                      style={correctionInput.trim().length >= 3 ? btnPrimary : { ...btnPrimary, opacity: 0.4, cursor: 'not-allowed' }}
                    >
                      apply
                    </button>
                    <button onClick={() => setShowCorrectionBox(false)} style={btnGhost}>cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={approveStep} style={btnApprove} data-testid="replay-approve">
                    ✓ approve
                  </button>
                  <button onClick={() => setShowCorrectionBox(true)} style={btnGhost}>
                    ✗ correct
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* All steps done */}
      {allDone && (
        <div style={activePanel}>
          <div style={sectionLabel}>── review complete ──</div>
          <div style={{ color: CLR.green, margin: '8px 0' }}>
            ✓ all {resolvedSteps.length} steps reviewed
            {Object.keys(corrections).length > 0 &&
              ` (${Object.keys(corrections).length} corrected)`}
          </div>

          {spec.knowledge_sources.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: CLR.dim, fontSize: 10, marginBottom: 4 }}>sources:</div>
              {spec.knowledge_sources.map((s, i) => (
                <div key={i} style={{ color: CLR.text, fontSize: 11 }}>
                  <span style={{ color: CLR.green }}>+</span> {s.name} — {s.reference}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            {Object.keys(corrections).length > 0 ? (
              <button
                onClick={handlePublish}
                disabled={isRebuilding}
                style={isRebuilding ? { ...btnPrimary, opacity: 0.5 } : btnPrimary}
              >
                {isRebuilding ? 'rebuilding...' : 'apply corrections & publish'}
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                style={isPublishing ? { ...btnPrimary, opacity: 0.5 } : btnPrimary}
              >
                {isPublishing ? 'publishing...' : 'publish agent'}
              </button>
            )}
            <button onClick={replayAgain} style={btnGhost}>replay again</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace"

const CLR = {
  bg: '#0a0c10',
  surface: '#12141a',
  border: '#1e2030',
  text: '#c9d1d9',
  dim: '#484f58',
  accent: '#7c6bf5',
  green: '#3fb950',
  amber: '#d29922',
  red: '#f85149',
}

const container: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  fontFamily: MONO,
  fontSize: 12,
}

const sectionLabel: React.CSSProperties = {
  color: CLR.accent,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
  marginBottom: 6,
}

const activePanel: React.CSSProperties = {
  background: CLR.surface,
  border: `1px solid ${CLR.border}`,
  borderRadius: 3,
  padding: '10px 12px',
  marginBottom: 8,
}

const kvRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 1,
  fontSize: 11,
  lineHeight: 1.6,
}

const kvKey: React.CSSProperties = {
  color: CLR.dim,
  minWidth: 60,
  flexShrink: 0,
}

const kvVal: React.CSSProperties = {
  color: CLR.text,
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  background: CLR.bg,
  border: `1px solid ${CLR.border}`,
  color: CLR.text,
  fontSize: 11,
  padding: '6px 8px',
  borderRadius: 2,
  resize: 'vertical',
  fontFamily: MONO,
  boxSizing: 'border-box',
  outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: CLR.accent,
  border: 'none',
  color: '#fff',
  padding: '5px 12px',
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
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: MONO,
  borderRadius: 2,
}

const btnApprove: React.CSSProperties = {
  background: 'rgba(63, 185, 80, 0.1)',
  border: `1px solid ${CLR.green}`,
  color: CLR.green,
  padding: '5px 12px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: MONO,
  borderRadius: 2,
}
