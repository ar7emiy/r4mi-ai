import { useR4miStore, AgentSpec, TrustLevel } from '../../store/r4mi.store'
import { useAgentverse } from '../../hooks/useAgentverse'

const TRUST_COLORS: Record<TrustLevel, { bg: string; text: string }> = {
  supervised: { bg: '#78350f', text: '#fbbf24' },
  autonomous: { bg: '#14532d', text: '#4ade80' },
  stale: { bg: '#7f1d1d', text: '#f87171' },
}

export function AgentversePanel() {
  const storeAgents = useR4miStore((s) => s.publishedAgents)
  const { data: fetchedAgents = [] } = useAgentverse()
  const agents: AgentSpec[] = storeAgents.length ? storeAgents : fetchedAgents

  if (agents.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#4a5568', fontSize: 13 }}>
        No agents published yet.
        <br />
        Complete the optimization flow to publish your first agent.
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        padding: 16,
      }}
    >
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentSpec }) {
  const trustStyle = TRUST_COLORS[agent.trust_level] ?? TRUST_COLORS.supervised
  const authorContribution = agent.contributions?.find((c) => c.role === 'author')

  return (
    <div
      style={{
        background: '#1a1d27',
        border: '1px solid #2d3149',
        borderRadius: 6,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Trust badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: trustStyle.bg,
            color: trustStyle.text,
            padding: '2px 8px',
            borderRadius: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {agent.trust_level}
        </span>
        {agent.parent_spec_id && (
          <span style={{ fontSize: 10, color: '#4a5568' }}>forked</span>
        )}
      </div>

      {/* Name */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>
        {agent.name}
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
        {agent.description}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#4a5568' }}>
        <span>✓ {agent.successful_runs ?? 0} runs</span>
        <span style={{ color: '#6366f1' }}>{agent.permit_type}</span>
      </div>

      {/* Contribution bar */}
      {authorContribution && (
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 3 }}>
            {authorContribution.user_id} — {authorContribution.share_pct}% contribution
          </div>
          <div
            style={{
              height: 3,
              background: '#2d3149',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${authorContribution.share_pct}%`,
                background: '#6366f1',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
