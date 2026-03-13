import { useState, useEffect } from 'react'
import { useR4miStore } from '../../store/r4mi.store'
import { AgentversePanel } from './AgentversePanel'
import { CLIPanel } from './CLIPanel'
import { SpecSummary } from './SpecSummary'
import { CorrectionInput } from './CorrectionInput'
import { SessionReplay } from './SessionReplay'
import { ValidationReplay } from './ValidationReplay'

export function OptimizationPanel() {
  const panelView = useR4miStore((s) => s.panelView)
  const setPanelView = useR4miStore((s) => s.setPanelView)
  const opportunitySessionId = useR4miStore((s) => s.opportunitySessionId)
  const currentSpec = useR4miStore((s) => s.currentSpec)
  const addPublishedAgent = useR4miStore((s) => s.addPublishedAgent)
  const setOpportunitySessionId = useR4miStore((s) => s.setOpportunitySessionId)
  const isRecording = useR4miStore((s) => s.isRecording)
  const [step, setStep] = useState<'replay' | 'correction' | 'spec' | 'validation' | 'done'>('replay')

  useEffect(() => {
    if (opportunitySessionId) setStep('replay')
  }, [opportunitySessionId])

  async function handlePublish() {
    if (!opportunitySessionId) return
    try {
      const res = await fetch('/api/agents/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: opportunitySessionId }),
      })
      const published = await res.json()
      addPublishedAgent(published)
      setOpportunitySessionId(null)
      setStep('done')
    } catch (e) {
      console.error(e)
    }
  }

  const isOpen = panelView !== 'closed'

  if (!isOpen) return null

  if (panelView === 'agentverse') {
    return <SidePanel title="Agentverse" onClose={() => setPanelView('closed')} wide>
      <AgentversePanel />
    </SidePanel>
  }

  if (panelView === 'cli') {
    return <SidePanel title="CLI Evidence" onClose={() => setPanelView('closed')} wide>
      <CLIPanel />
    </SidePanel>
  }

  if (panelView === 'spec') {
    return <SidePanel title="Agent Spec" onClose={() => setPanelView('closed')}>
      <SpecSummary spec={currentSpec} onReview={() => { setStep('validation'); setPanelView('optimization') }} />
    </SidePanel>
  }

  // optimization flow
  return (
    <SidePanel
      title="r4mi-ai detected a repetitive workflow"
      subtitle="I've seen this pattern 3 times. Here's what I observed."
      onClose={() => setPanelView('closed')}
      isRecording={isRecording}
    >
      {step === 'replay' && (
        <SessionReplay
          sessionId={opportunitySessionId}
          onConfirmed={() => setStep('correction')}
        />
      )}
      {step === 'correction' && (
        <CorrectionInput
          sessionId={opportunitySessionId}
          onDone={() => setStep('spec')}
        />
      )}
      {step === 'spec' && (
        <SpecSummary
          spec={currentSpec}
          onReview={() => setStep('validation')}
        />
      )}
      {step === 'validation' && (
        <ValidationReplay
          spec={currentSpec}
          onFinished={handlePublish}
        />
      )}
      {step === 'done' && (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 4 }}>
            Agent published to Agentverse
          </div>
          <button
            onClick={() => {
              setPanelView('agentverse')
            }}
            style={actionBtn}
          >
            View in Agentverse
          </button>
        </div>
      )}
    </SidePanel>
  )
}

function SidePanel({
  title,
  subtitle,
  onClose,
  wide = false,
  isRecording = false,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  wide?: boolean
  isRecording?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 48,
        width: wide ? 600 : 420,
        background: '#0f1117',
        borderLeft: '1px solid #2d3149',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #2d3149',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#6366f1', fontWeight: 700, fontSize: 13 }}>{title}</div>
            {isRecording && (
              <span
                style={{
                  background: 'rgba(220, 38, 38, 0.1)',
                  color: '#dc2626',
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 20,
                  border: '1px solid #dc2626',
                  animation: 'pulse-red 1.5s infinite',
                }}
              >
                🤖 CUA MODEL: RECORDING ACTIVE
              </span>
            )}
          </div>
          {subtitle && (
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#4a5568',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="dark-scroll">
        {children}
      </div>
      <style>{`
        @keyframes pulse-red {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}

const actionBtn: React.CSSProperties = {
  marginTop: 12,
  background: '#6366f1',
  border: 'none',
  color: '#fff',
  padding: '8px 20px',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 4,
}
