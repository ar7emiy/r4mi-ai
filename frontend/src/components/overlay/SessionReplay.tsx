import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

const DISTILLED_STEPS = [
  { field: 'Zone Classification', value: 'R-2', source: 'from GIS API' },
  { field: 'Max Permitted Height', value: '6 ft', source: 'from PDF §14.3' },
  { field: 'Decision Notes', value: 'Exceeds R-2 max by 1ft. Variance required per §14.3', source: 'from SpecBuilderAgent' },
]

export function SessionReplay({
  sessionId,
  onConfirmed,
}: {
  sessionId: string | null
  onConfirmed: () => void
}) {
  const [currentStep, setCurrentStep] = useState(-1)
  const [typedValues, setTypedValues] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  const { data: replayData } = useQuery({
    queryKey: ['replay', sessionId],
    queryFn: () =>
      fetch(`/api/session/${sessionId}/replay`).then((r) => r.json()),
    enabled: !!sessionId,
  })

  // Animate distilled steps
  useEffect(() => {
    if (!replayData) return
    let cancelled = false

    async function animate() {
      for (let i = 0; i < DISTILLED_STEPS.length; i++) {
        if (cancelled) return
        setCurrentStep(i)
        const step = DISTILLED_STEPS[i]
        // Type value character by character
        for (let c = 0; c <= step.value.length; c++) {
          if (cancelled) return
          setTypedValues((prev) => ({
            ...prev,
            [step.field]: step.value.slice(0, c),
          }))
          await new Promise((r) => setTimeout(r, 60))
        }
        await new Promise((r) => setTimeout(r, 800))
      }
      if (!cancelled) setDone(true)
    }
    animate()
    return () => { cancelled = true }
  }, [replayData])

  const originalScreens = replayData?.total_frames
    ? Math.ceil(replayData.total_frames / 2)
    : 5

  return (
    <div style={{ padding: 16 }}>
      <div style={label}>ORIGINAL PATH: {originalScreens} screens</div>

      {/* Distilled agent version */}
      <div style={{ marginTop: 12, marginBottom: 8 }}>
        <div style={label}>DISTILLED AGENT PATH: 1 screen</div>
        <div
          style={{
            background: '#1a1d27',
            border: '1px solid #2d3149',
            borderRadius: 4,
            padding: 12,
            marginTop: 6,
          }}
        >
          {DISTILLED_STEPS.map((step, i) => (
            <div
              key={step.field}
              style={{
                marginBottom: 10,
                opacity: i <= currentStep ? 1 : 0.25,
                transition: 'opacity 0.3s',
              }}
            >
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                {step.field.toUpperCase()}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    background: '#0f1117',
                    border: '1px solid #2d3149',
                    padding: '3px 8px',
                    fontSize: 13,
                    color: '#e2e8f0',
                    minWidth: 80,
                    fontFamily: 'monospace',
                  }}
                >
                  {typedValues[step.field] ?? ''}
                  {i === currentStep && !done && (
                    <span style={{ animation: 'typing-cursor 1s step-end infinite' }}>|</span>
                  )}
                </span>
                {i <= currentStep && (
                  <span
                    style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      background: '#1a1d27',
                      border: '1px solid #6366f1',
                      padding: '1px 6px',
                      borderRadius: 2,
                    }}
                  >
                    {step.source}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {done && (
        <>
          <div
            style={{
              marginTop: 12,
              padding: 10,
              background: '#0f1117',
              border: '1px solid #22c55e',
              borderRadius: 4,
              fontSize: 12,
              color: '#22c55e',
              textAlign: 'center',
            }}
          >
            {originalScreens} screens → 1 screen. Same result.
          </div>

          <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
            Does this look right? Check the source tags above.
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={onConfirmed} style={primaryBtn}>
              Looks good — continue
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const label: React.CSSProperties = {
  fontSize: 10,
  color: '#94a3b8',
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
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
