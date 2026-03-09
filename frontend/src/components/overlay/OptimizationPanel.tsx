import { useState, useEffect } from 'react'
import { useR4miStore } from '../../store/r4mi.store'
import { AgentversePanel } from './AgentversePanel'
import { CLIPanel } from './CLIPanel'
import { SpecSummary } from './SpecSummary'
import { CorrectionInput } from './CorrectionInput'
import { SessionReplay } from './SessionReplay'

export function OptimizationPanel() {
  const panelView = useR4miStore((s) => s.panelView)
  const setPanelView = useR4miStore((s) => s.setPanelView)
  const opportunitySessionId = useR4miStore((s) => s.opportunitySessionId)
  const currentSpec = useR4miStore((s) => s.currentSpec)
  const [step, setStep] = useState<'replay' | 'correction' | 'spec' | 'done'>('replay')

  // Reset flow when a new opportunity arrives
  useEffect(() => {
    if (opportunitySessionId) setStep('replay')
  }, [opportunitySessionId])

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
      <SpecSummary spec={currentSpec} sessionId={opportunitySessionId} />
    </SidePanel>
  }

  // optimization flow
  return (
    <SidePanel
      title="r4mi-ai detected a repetitive workflow"
      subtitle="I've seen this pattern 3 times. Here's what I observed."
      onClose={() => setPanelView('closed')}
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
          sessionId={opportunitySessionId}
          onPublished={() => setStep('done')}
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
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  wide?: boolean
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
          <div style={{ color: '#6366f1', fontWeight: 700, fontSize: 13 }}>{title}</div>
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
