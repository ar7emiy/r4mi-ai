import { useR4miStore } from '../../store/r4mi.store'
import { useAgentverse } from '../../hooks/useAgentverse'
import { useNavigate } from 'react-router-dom'

export function TabProgressionBar() {
  const opportunitySessionId = useR4miStore((s) => s.opportunitySessionId)
  const panelView = useR4miStore((s) => s.panelView)
  const setPanelView = useR4miStore((s) => s.setPanelView)
  const publishedAgents = useR4miStore((s) => s.publishedAgents)
  const navigate = useNavigate()

  const { data: fetchedAgents = [] } = useAgentverse()
  const allAgents = publishedAgents.length ? publishedAgents : fetchedAgents

  const hasOpportunity = !!opportunitySessionId

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 48,
        background: '#0f1117',
        borderTop: '1px solid #2d3149',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        zIndex: 1000,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Logo */}
      <div
        style={{
          color: '#6366f1',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: 1,
          flexShrink: 0,
        }}
      >
        r4mi-ai
      </div>

      <div style={{ width: 1, height: 24, background: '#2d3149' }} />

      {/* Active agents */}
      <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'hidden' }}>
        {allAgents.length === 0 ? (
          <span style={{ color: '#4a5568', fontSize: 12 }}>No active agents</span>
        ) : (
          allAgents.slice(0, 4).map((agent) => (
            <div
              key={agent.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#1a1d27',
                border: '1px solid #2d3149',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 12,
                color: '#e2e8f0',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background:
                    agent.trust_level === 'autonomous'
                      ? '#22c55e'
                      : agent.trust_level === 'stale'
                        ? '#ef4444'
                        : '#f59e0b',
                  flexShrink: 0,
                }}
              />
              {agent.name ?? 'Agent'} · {agent.successful_runs ?? 0} runs
            </div>
          ))
        )}
      </div>

      {/* Nav links */}
      <button
        onClick={() => setPanelView(panelView === 'agentverse' ? 'closed' : 'agentverse')}
        style={navBtnStyle}
      >
        Agentverse {allAgents.length > 0 && `(${allAgents.length})`}
      </button>

      <button
        onClick={() => setPanelView(panelView === 'cli' ? 'closed' : 'cli')}
        style={navBtnStyle}
      >
        CLI
      </button>

      <button onClick={() => navigate('/system')} style={navBtnStyle}>
        Architecture
      </button>

      {/* Opportunity notification */}
      {hasOpportunity && (
        <button
          onClick={() => setPanelView('optimization')}
          style={{
            ...navBtnStyle,
            background: '#6366f1',
            border: '1px solid #4f46e5',
            color: '#fff',
            fontWeight: 700,
            animation: 'pulse-glow 2s ease-in-out infinite',
          }}
        >
          Optimization detected
        </button>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2d3149',
  color: '#94a3b8',
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: 4,
  flexShrink: 0,
}
