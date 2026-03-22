import { useState, useEffect } from 'react'

interface ActionStep {
  step: number
  action?: string
  description?: string
  field?: string
  source?: string
  value?: string
}

interface Props {
  steps: ActionStep[]
  sessionId: string
  onConfirmed: () => void
  onSkip: (sessionId: string) => void
  onCorrect: (sessionId: string, correction: string) => void
  onShowMe: (sessionId: string) => void
}

export function ReplayPreview({ steps, sessionId, onConfirmed, onSkip, onCorrect, onShowMe }: Props) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [correctionText, setCorrectionText] = useState('')
  const [showMeDone, setShowMeDone] = useState(false)

  // Stagger steps in with 400ms intervals
  useEffect(() => {
    if (visibleCount >= steps.length) return
    const t = setTimeout(() => setVisibleCount((n) => n + 1), visibleCount === 0 ? 300 : 400)
    return () => clearTimeout(t)
  }, [visibleCount, steps.length])

  const allVisible = visibleCount >= steps.length
  // Show confirm button at least 1.5s after first step appears
  const [confirmReady, setConfirmReady] = useState(false)
  useEffect(() => {
    if (!allVisible) return
    const t = setTimeout(() => setConfirmReady(true), 1500)
    return () => clearTimeout(t)
  }, [allVisible])

  function handleConfirm() {
    setConfirmed(true)
    onConfirmed()
  }

  function handleCorrect() {
    if (!correctionText.trim() && !showMeDone) return
    onCorrect(sessionId, correctionText.trim())
  }

  function handleShowMe() {
    setShowMeDone(true)
    onShowMe(sessionId)
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        You navigated {steps.length} screens. Here&apos;s the distilled version:
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {steps.slice(0, visibleCount).map((s, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              animation: 'fadeIn 0.3s ease',
            }}
          >
            <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
              {s.step}.
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ color: '#e2e8f0', fontSize: 11 }}>
                {s.description || s.action}
              </span>
              {s.source && (
                <span style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: '#94a3b8',
                  background: '#1a1d27',
                  border: '1px solid #6366f1',
                  padding: '1px 5px',
                  borderRadius: 3,
                }}>
                  {s.source}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirm button */}
      {!confirmed && confirmReady && (
        <button
          data-testid="replay-confirm-btn"
          onClick={handleConfirm}
          style={confirmBtn}
        >
          Looks good — continue
        </button>
      )}

      {/* Correction sub-card */}
      {confirmed && (
        <div style={{
          marginTop: 10,
          padding: '10px 12px',
          background: '#0f1117',
          border: '1px solid #2d3149',
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            Anything to correct? (Optional)
          </div>
          <textarea
            value={correctionText}
            onChange={(e) => setCorrectionText(e.target.value)}
            placeholder="Describe the correction here..."
            rows={3}
            style={{
              width: '100%',
              background: '#1a1d27',
              border: '1px solid #2d3149',
              color: '#e2e8f0',
              fontSize: 11,
              padding: '6px 8px',
              borderRadius: 3,
              resize: 'vertical',
              fontFamily: 'Inter, system-ui, sans-serif',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <button
              onClick={handleShowMe}
              style={{
                background: 'transparent',
                border: '1px solid #6366f1',
                color: '#6366f1',
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Show me
            </button>
            <button
              onClick={handleCorrect}
              disabled={correctionText.trim().length < 3 && !showMeDone}
              style={{
                background: correctionText.trim().length >= 3 || showMeDone ? '#6366f1' : '#2d3149',
                border: 'none',
                color: correctionText.trim().length >= 3 || showMeDone ? '#fff' : '#4a5568',
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 3,
                cursor: correctionText.trim().length >= 3 || showMeDone ? 'pointer' : 'not-allowed',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Confirm &amp; continue
            </button>
            <button
              onClick={() => onSkip(sessionId)}
              style={{
                background: 'none',
                border: 'none',
                color: '#4a5568',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Skip correction
            </button>
          </div>
          {showMeDone && (
            <div style={{ marginTop: 6, fontSize: 10, color: '#22c55e' }}>
              Source recorded. Click &quot;Confirm &amp; continue&quot; to apply.
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  )
}

const confirmBtn: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  color: '#fff',
  padding: '5px 14px',
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
}
