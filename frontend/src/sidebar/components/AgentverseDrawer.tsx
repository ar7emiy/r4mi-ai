import { useState, useEffect } from 'react'

const API_BASE =
  new URLSearchParams(window.location.search).get('api') ||
  'http://localhost:8000'

interface Agent {
  id: string
  name: string
  description: string
  permit_type: string
  trust_level: string
  successful_runs: number
  failed_runs: number
}

interface Props {
  onClose: () => void
  activeApplicationId: string | null
  onRun: (specId: string, specName: string) => void
}

export function AgentverseDrawer({ onClose, activeApplicationId, onRun }: Props) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/agents`)
      .then((r) => r.json())
      .then((data) => {
        setAgents(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={root}>
      {/* Header */}
      <div style={header}>
        <span style={headerTitle}>r4mi</span>
        <span style={headerPhase}>agents</span>
        <button onClick={onClose} style={headerBtn}>back</button>
      </div>

      <div style={mainArea}>
        <div style={sectionLabel}>── published agents ──</div>

        {loading && <div style={{ color: CLR.dim, fontSize: 11, padding: '8px 0' }}>loading...</div>}

        {!loading && agents.length === 0 && (
          <div style={{ color: CLR.dim, fontSize: 11, padding: '8px 0' }}>
            no agents published yet. detect a pattern or use teach-me to create one.
          </div>
        )}

        {agents.map((a) => {
          const isStale = a.trust_level === 'stale'
          const trustColor =
            a.trust_level === 'autonomous' ? CLR.green :
            isStale ? CLR.dim :
            CLR.amber
          return (
            <div key={a.id} data-testid="agent-card" style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: CLR.text, fontWeight: 600, fontSize: 11 }}>{a.name}</span>
                <span style={{ color: trustColor, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em' }}>
                  {a.trust_level}
                </span>
              </div>
              <div style={{ color: CLR.dim, fontSize: 10, marginBottom: 6 }}>{a.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: CLR.dim, fontSize: 10 }}>
                  {a.successful_runs} runs | {a.permit_type}
                </span>
                {!isStale && (
                  <button
                    onClick={() => onRun(a.id, a.name)}
                    disabled={!activeApplicationId}
                    style={activeApplicationId ? btnRun : { ...btnRun, opacity: 0.3, cursor: 'not-allowed' }}
                  >
                    run
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace"

const CLR = {
  bg: '#0a0c10',
  surface: '#12141a',
  border: '#1e2030',
  text: '#c9d1d9',
  dim: '#484f58',
  accent: '#7c6bf5',
  green: '#3fb950',
  amber: '#d29922',
}

const root: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: CLR.bg,
  fontFamily: MONO,
  color: CLR.text,
  fontSize: 12,
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderBottom: `1px solid ${CLR.border}`,
  flexShrink: 0,
}

const headerTitle: React.CSSProperties = {
  color: CLR.accent,
  fontWeight: 700,
  fontSize: 13,
}

const headerPhase: React.CSSProperties = {
  color: CLR.dim,
  fontSize: 11,
  flex: 1,
}

const headerBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${CLR.border}`,
  color: CLR.dim,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: MONO,
  borderRadius: 2,
}

const mainArea: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
}

const sectionLabel: React.CSSProperties = {
  color: CLR.accent,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
  marginBottom: 8,
}

const card: React.CSSProperties = {
  background: CLR.surface,
  border: `1px solid ${CLR.border}`,
  borderRadius: 3,
  padding: '8px 10px',
  marginBottom: 6,
}

const btnRun: React.CSSProperties = {
  background: CLR.accent,
  border: 'none',
  color: '#fff',
  padding: '3px 10px',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: MONO,
  borderRadius: 2,
}
