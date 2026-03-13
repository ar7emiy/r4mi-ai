import { useState } from 'react'
import { useR4miStore, AgentSpec } from '../../store/r4mi.store'

export function ValidationReplay({
    spec,
    onFinished,
}: {
    spec: AgentSpec | null
    onFinished: () => void
}) {
    const [isPlaying, setIsPlaying] = useState(false)
    const [complete, setComplete] = useState(false)
    const appendDemoStep = useR4miStore((s) => s.appendDemoStep)
    const clearDemoSteps = useR4miStore((s) => s.clearDemoSteps)

    async function startReplay() {
        if (!spec) return
        setIsPlaying(true)
        setComplete(false)
        clearDemoSteps()

        // Mimic the payoff typing animation
        const INPUT_VERBS = new Set(['input', 'type', 'fill', 'enter', 'set', 'update', 'populate'])
        const steps = (spec.action_sequence ?? [])
            .filter((s) => INPUT_VERBS.has((s.action ?? '').toLowerCase()) || !!s.field)
            .map((s, i) => {
                let value = ''
                const field = s.field?.toLowerCase() || ''
                const source = s.source?.toLowerCase() || ''

                if (source.includes('gis') || field.includes('zone')) value = 'R-2'
                else if (source.includes('policy') || source.includes('§') || source.includes('pdf')) {
                    if (field.includes('height')) value = '6 ft'
                    else if (field.includes('note') || field.includes('decision')) value = 'Height of 6ft is permitted.'
                } else if (source.includes('owner') || field.includes('owner')) {
                    value = 'Margaret Hollis'
                } else if (field.includes('note') || field.includes('decision')) {
                    value = 'Auto-assessed per policy. Compliance verified.'
                }

                return {
                    step: i + 1,
                    action: s.action,
                    field: s.field,
                    value: value,
                    source_tag: s.source,
                    confidence: 0.98,
                    status: 'ok',
                }
            })

        for (const step of steps) {
            appendDemoStep(step)
            await new Promise((r) => setTimeout(r, 1200))
        }

        setIsPlaying(false)
        setComplete(true)
    }

    return (
        <div style={{ padding: 16 }}>
            <div style={sectionLabel}>HITL VALIDATION REPLAY</div>
            <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 12 }}>
                Please validate the corrected workflow steps before publishing. r4mi-ai will now demonstrate the updated logic in the application form.
            </div>

            <div
                style={{
                    background: '#1a1d27',
                    border: '1px solid #2d3149',
                    borderRadius: 4,
                    padding: 20,
                    textAlign: 'center',
                    marginBottom: 16,
                }}
            >
                {!isPlaying && !complete && (
                    <button onClick={startReplay} style={primaryBtn}>
                        Begin Validation Replay
                    </button>
                )}

                {isPlaying && (
                    <div>
                        <div className="spinner" style={{ marginBottom: 10 }}></div>
                        <div style={{ fontSize: 13, color: '#6366f1', fontWeight: 600 }}>
                            REPLAYING UPDATED WORKFLOW...
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                            Check the Application Form to see the automation in action.
                        </div>
                    </div>
                )}

                {complete && (
                    <div>
                        <div style={{ fontSize: 24, color: '#22c55e', marginBottom: 8 }}>✓</div>
                        <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>
                            Validation Complete
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                            The agent logic is confirmed. You may now publish to Agentverse.
                        </div>
                    </div>
                )}
            </div>

            {complete && (
                <button onClick={onFinished} style={publishBtn}>
                    Publish to Agentverse
                </button>
            )}

            <style>{`
        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid rgba(99, 102, 241, 0.1);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
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
    padding: '10px 20px',
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 4,
}

const publishBtn: React.CSSProperties = {
    background: '#22c55e',
    border: 'none',
    color: '#fff',
    padding: '12px 24px',
    cursor: 'pointer',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 14,
    fontWeight: 700,
    borderRadius: 4,
    width: '100%',
}
