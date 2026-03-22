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
  const [search, setSearch] = useState('')
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

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.permit_type.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={container}>
      <div style={header}>
        <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13 }}>Agentverse</div>
        <button onClick={onClose} style={closeBtn}>x</button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search agents..."
        style={searchInput}
      />

      <div style={list}>
        {loading && <div style={{ color: '#4a5568', fontSize: 12, padding: 12 }}>Loading...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: '#4a5568', fontSize: 12, padding: 12 }}>No agents found.</div>
        )}
        {filtered.map((a) => {
          const isStale = a.trust_level === 'stale'
          const trustColor = a.trust_level === 'autonomous' ? '#22c55e' : isStale ? '#94a3b8' : '#f59e0b'
          return (
            <div key={a.id} data-testid="agent-card" style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12 }}>{a.name}</div>
                <span style={{ ...trustBadge, color: trustColor, borderColor: trustColor, background: `${trustColor}15` }}>
                  {a.trust_level.toUpperCase()}
                </span>
              </div>
              <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>{a.description}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#4a5568', fontSize: 10 }}>
                  {a.successful_runs} runs | {a.permit_type}
                </div>
                {isStale ? (
                  <span style={{ color: '#4a5568', fontSize: 10, fontStyle: 'italic' }}>Stale</span>
                ) : (
                  <button
                    onClick={() => onRun(a.id, a.name)}
                    disabled={!activeApplicationId}
                    style={{
                      background: activeApplicationId ? '#6366f1' : '#2d3149',
                      border: 'none',
                      color: activeApplicationId ? '#fff' : '#4a5568',
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 3,
                      cursor: activeApplicationId ? 'pointer' : 'not-allowed',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                  >
                    Run
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

const container: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#0f1117',
}

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 12px',
  borderBottom: '1px solid #2d3149',
}

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#4a5568',
  cursor: 'pointer',
  fontSize: 14,
}

const searchInput: React.CSSProperties = {
  margin: '8px 12px',
  padding: '7px 10px',
  background: '#1a1d27',
  border: '1px solid #2d3149',
  borderRadius: 4,
  color: '#e2e8f0',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
}

const list: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 12px',
}

const card: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px solid #2d3149',
  borderRadius: 6,
  padding: '10px 12px',
  marginBottom: 6,
}

const trustBadge: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  padding: '1px 6px',
  borderRadius: 10,
  border: '1px solid',
}
