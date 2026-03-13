import { AgentSpec } from '../../store/r4mi.store'

export function SpecSummary({
  spec,
  onReview,
}: {
  spec: AgentSpec | null
  onReview: () => void
}) {
  if (!spec) {
    return (
      <div style={{ padding: 16, color: '#94a3b8', fontSize: 12 }}>
        No spec available yet.
      </div>
    )
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={sectionLabel}>AGENT SPEC PREVIEW</div>

      <div
        style={{
          background: '#1a1d27',
          border: '1px solid #2d3149',
          borderRadius: 4,
          padding: 14,
          marginTop: 8,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
          {spec.name}
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
          {spec.description}
        </div>

        <div style={subsectionLabel}>ACTION SEQUENCE</div>
        {(spec.action_sequence ?? []).map((step, i) => (
          <div key={i} style={stepRow}>
            <span style={stepNum}>{step.step}</span>
            <div>
              <div style={{ fontSize: 12, color: '#e2e8f0' }}>{step.description || step.action}</div>
              <div style={{ fontSize: 10, color: '#6366f1' }}>{step.source}</div>
            </div>
          </div>
        ))}

        <div style={{ ...subsectionLabel, marginTop: 12 }}>KNOWLEDGE SOURCES</div>
        {(spec.knowledge_sources ?? []).map((ks, i) => (
          <div key={i} style={sourceRow}>
            <span style={{ color: '#22c55e', marginRight: 6 }}>✓</span>
            <span style={{ fontSize: 12, color: '#e2e8f0' }}>{ks.name}</span>
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
              {ks.reference}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: '#94a3b8',
                background: '#0f1117',
                padding: '1px 6px',
                borderRadius: 2,
              }}
            >
              conf={((ks.confidence ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onReview}
          style={{
            background: '#6366f1',
            border: 'none',
            color: '#fff',
            padding: '12px 24px',
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 4,
            width: '100%',
          }}
        >
          Review & Validate Workflow
        </button>
      </div>
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

const subsectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#4a5568',
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 6,
}

const stepRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 8,
  alignItems: 'flex-start',
}

const stepNum: React.CSSProperties = {
  background: '#6366f1',
  color: '#fff',
  width: 20,
  height: 20,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
}

const sourceRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 6,
  gap: 2,
}
