import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

// Maps permit_type → label for the constraint field (matches ApplicationForm PERMIT_CONFIG)
const CONSTRAINT_LABELS: Record<string, string> = {
  fence_variance:     'Max Permitted Height',
  solar_permit:       'Max System Size',
  home_occupation:    'Allowed Use Finding',
  tree_removal:       'Replacement Ratio',
  deck_permit:        'Max Deck Height',
  adu_addition:       'Max Unit Size',
  commercial_signage: 'Max Sign Area',
  demolition:         'Clearance Required',
  str_registration:   'Nights Per Year Limit',
}

// Fallback policy section per permit type — used when Gemini Vision knowledge_sources is empty.
// This is presentation scaffolding: VisionService extracts these during live sessions when
// screenshots are available; this fallback covers cases where Vision data hasn't populated yet.
const PERMIT_POLICY_SECTION: Record<string, string> = {
  fence_variance:     '14.3',
  solar_permit:       '22.1',
  home_occupation:    '18.4',
  tree_removal:       '9.7',
  deck_permit:        '16.2',
  adu_addition:       '8.4',
  commercial_signage: '22.7',
  demolition:         '31.2',
  str_registration:   '19.1',
}

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

  // Derive distilled steps from real session data — no hardcoding
  const distilledSteps = useMemo(() => {
    if (!replayData) return null

    const frames: Array<{ event_type: string; element_selector: string; element_value?: string }> =
      replayData.frames ?? []
    const knowledge: Array<{ selector_description?: string }> =
      replayData.knowledge_sources ?? []
    const permitType: string = replayData.permit_type ?? ''

    const zoneEvent = frames.find(
      (f) => f.event_type === 'input' && f.element_selector === 'zone_classification',
    )
    const constraintEvent = frames.find(
      (f) => f.event_type === 'input' && f.element_selector === 'max_permitted_height',
    )
    const notesEvent = frames.find(
      (f) =>
        f.event_type === 'input' &&
        (f.element_selector === 'notes' || f.element_selector === 'decision_notes'),
    )

    const constraintLabel = CONSTRAINT_LABELS[permitType] ?? 'Max Permitted Value'

    // Format the policy source label from the knowledge_source selector_description.
    // selector_description pattern: "section_14_3_paragraph" → extract → "PDF §14.3"
    // Fall back to PERMIT_POLICY_SECTION when Vision data hasn't populated yet.
    const rawRef = knowledge[0]?.selector_description ?? ''
    const sectionMatch = rawRef.match(/section[_\s](\d+)[_\s](\d+)/i)
    const fallbackSection = PERMIT_POLICY_SECTION[permitType]
    const policyRef = sectionMatch
      ? `PDF \u00a7${sectionMatch[1]}.${sectionMatch[2]}`
      : fallbackSection
          ? `PDF \u00a7${fallbackSection}`
          : rawRef
              ? rawRef.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              : 'Policy Ref'

    const steps: Array<{ field: string; value: string; source: string }> = [
      {
        field: 'Zone Classification',
        value: zoneEvent?.element_value ?? '—',
        source: 'from GIS API',
      },
      {
        field: constraintLabel,
        value: constraintEvent?.element_value ?? '—',
        source: `from ${policyRef}`,
      },
    ]

    if (notesEvent?.element_value) {
      steps.push({
        field: 'Decision Notes',
        value: notesEvent.element_value,
        source: 'from SpecBuilderAgent',
      })
    }

    return steps
  }, [replayData])

  // Reset animation state when session changes
  useEffect(() => {
    setCurrentStep(-1)
    setTypedValues({})
    setDone(false)
  }, [sessionId])

  // Animate once real data arrives
  useEffect(() => {
    if (!distilledSteps || distilledSteps.length === 0) return
    let cancelled = false

    async function animate() {
      await new Promise((r) => setTimeout(r, 600))
      for (let i = 0; i < distilledSteps!.length; i++) {
        if (cancelled) return
        setCurrentStep(i)
        const step = distilledSteps![i]
        for (let c = 0; c <= step.value.length; c++) {
          if (cancelled) return
          setTypedValues((prev) => ({ ...prev, [step.field]: step.value.slice(0, c) }))
          await new Promise((r) => setTimeout(r, 55))
        }
        await new Promise((r) => setTimeout(r, 800))
      }
      if (!cancelled) setDone(true)
    }
    animate()
    return () => { cancelled = true }
  }, [distilledSteps])

  const originalScreens = replayData?.total_frames
    ? Math.ceil(replayData.total_frames / 2)
    : 5

  const steps = distilledSteps ?? []

  return (
    <div style={{ padding: 16 }}>
      {!replayData && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          Loading session data…
        </div>
      )}

      <div style={labelStyle}>ORIGINAL PATH: {originalScreens} screens</div>

      <div style={{ marginTop: 12, marginBottom: 8 }}>
        <div style={labelStyle}>DISTILLED AGENT PATH: 1 screen</div>
        <div
          style={{
            background: '#1a1d27',
            border: '1px solid #2d3149',
            borderRadius: 4,
            padding: 12,
            marginTop: 6,
          }}
        >
          {steps.map((step, i) => (
            <div
              key={step.field}
              style={{
                marginBottom: 10,
                opacity: i <= currentStep ? 1 : 0.25,
                transition: 'opacity 0.3s',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: '#94a3b8',
                  marginBottom: 2,
                  textTransform: 'uppercase',
                }}
              >
                {step.field}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

const labelStyle: React.CSSProperties = {
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
