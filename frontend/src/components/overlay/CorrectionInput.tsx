import { useState, useEffect } from 'react'
import { useR4miStore } from '../../store/r4mi.store'

export function CorrectionInput({
  sessionId,
  onDone,
}: {
  sessionId: string | null
  onDone: () => void
}) {
  const [correction, setCorrection] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoRequested, setDemoRequested] = useState(false)
  const setDemoMode = useR4miStore((s) => s.setDemoMode)
  const setCurrentSpec = useR4miStore((s) => s.setCurrentSpec)
  const setIsRecording = useR4miStore((s) => s.setIsRecording)
  const setNavigateTo = useR4miStore((s) => s.setNavigateTo)

  // Listen for source selected in demo mode
  useEffect(() => {
    function handleSourceSelected(e: Event) {
      const detail = (e as CustomEvent).detail
      setDemoMode(false)
      setDemoRequested(false)
      setIsRecording(false)
      setCorrection(
        (prev) =>
          prev +
          (prev ? ' ' : '') +
          `Source confirmed: ${detail.source_type === 'pdf' ? 'PDF' : 'Wiki'} §${detail.section}`,
      )
    }
    window.addEventListener('r4mi:source-selected', handleSourceSelected)
    return () => window.removeEventListener('r4mi:source-selected', handleSourceSelected)
  }, [])

  async function handleShowMe() {
    setDemoRequested(true)
    setDemoMode(true)
    setIsRecording(true)
    setNavigateTo('policy')
  }

  async function handleSubmit() {
    if (!sessionId) return
    setLoading(true)
    try {
      // First confirm sources
      await fetch(`/api/session/${sessionId}/confirm/sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed_steps: [] }),
      })

      // Build spec with correction
      const res = await fetch('/api/agents/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          correction: correction || null,
        }),
      })
      const data = await res.json()
      setCurrentSpec(data.spec)
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={sectionLabel}>CORRECTION (OPTIONAL)</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
        If anything in the distilled workflow is wrong, describe the correction below.
        The expert's input takes priority.
      </div>

      <div
        style={{
          background: '#1a1d27',
          border: '1px solid #2d3149',
          borderRadius: 4,
          padding: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>
          EXAMPLE: "The policy source should be the PDF document, not the wiki."
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#4a5568',
            marginBottom: 6,
            fontStyle: 'italic',
          }}
        >
          Policy Source shown: Internal Wiki §14.3
        </div>
      </div>

      <textarea
        value={correction}
        onChange={(e) => setCorrection(e.target.value)}
        placeholder="Describe the correction here..."
        rows={4}
        style={{
          width: '100%',
          background: '#1a1d27',
          border: '1px solid #2d3149',
          color: '#e2e8f0',
          padding: '8px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 13,
          resize: 'vertical',
          borderRadius: 4,
          marginBottom: 10,
        }}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        {correction && !demoRequested && (
          <button onClick={handleShowMe} style={secondaryBtn}>
            Show me
          </button>
        )}
        <button onClick={handleSubmit} disabled={loading} style={primaryBtn}>
          {loading ? 'Regenerating spec...' : 'Confirm & continue'}
        </button>
      </div>

      {demoRequested && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: '#1a0000',
            border: '1px solid #dc2626',
            borderRadius: 4,
            fontSize: 12,
            color: '#fca5a5',
          }}
        >
          Navigate to the correct source in the legacy UI. Click the relevant paragraph
          in the PDF Viewer to register it as a source. r4mi-ai is watching.
        </div>
      )}
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#94a3b8',
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 6,
}

const primaryBtn: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  color: '#fff',
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 4,
}

const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #6366f1',
  color: '#6366f1',
  padding: '8px 16px',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  borderRadius: 4,
}
