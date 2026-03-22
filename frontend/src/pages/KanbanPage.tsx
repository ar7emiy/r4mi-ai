import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:8000'

interface Story {
  id: string
  title: string
  epic: string
  priority: 'P0' | 'P1' | 'P2'
  status: 'todo' | 'in-progress' | 'done' | 'blocked'
  files_affected: string[]
  notes: string
}

interface KanbanData {
  updated_at: string
  stories: Story[]
}

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 }
const PRIORITY_COLOR: Record<string, string> = { P0: '#dc2626', P1: '#f59e0b', P2: '#64748b' }

const COLUMNS: { id: Story['status']; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
]

export function KanbanPage() {
  const [data, setData] = useState<KanbanData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/kanban`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  const storiesByStatus = (status: Story['status']) =>
    (data?.stories ?? [])
      .filter((s) => s.status === status)
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <div style={root}>
      <div style={header}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>r4mi-ai — Story Board</div>
        {data && (
          <div style={{ fontSize: 11, color: '#4a5568' }}>
            Updated {new Date(data.updated_at).toLocaleDateString()} · auto-refreshes every 30s
          </div>
        )}
        {error && <div style={{ fontSize: 11, color: '#ef4444' }}>Failed to load: {error}</div>}
      </div>

      <div style={board}>
        {COLUMNS.map((col) => {
          const stories = storiesByStatus(col.id)
          return (
            <div key={col.id} style={column}>
              <div style={columnHeader}>
                <span style={{ color: col.id === 'done' ? '#22c55e' : col.id === 'in-progress' ? '#6366f1' : '#94a3b8' }}>
                  {col.label}
                </span>
                <span style={badge}>{stories.length}</span>
              </div>
              {stories.map((s) => (
                <div key={s.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 11 }}>{s.id}</span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 8,
                      border: `1px solid ${PRIORITY_COLOR[s.priority]}`,
                      color: PRIORITY_COLOR[s.priority],
                      background: `${PRIORITY_COLOR[s.priority]}15`,
                    }}>
                      {s.priority}
                    </span>
                  </div>
                  <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 500, marginBottom: 4, lineHeight: 1.4 }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginBottom: s.notes ? 4 : 0 }}>{s.epic}</div>
                  {s.notes && (
                    <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}>{s.notes}</div>
                  )}
                </div>
              ))}
              {stories.length === 0 && (
                <div style={{ color: '#2d3149', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>Empty</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const root: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f1117',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '24px 32px',
}

const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginBottom: 24,
  borderBottom: '1px solid #2d3149',
  paddingBottom: 16,
}

const board: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 16,
  alignItems: 'start',
}

const column: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px solid #2d3149',
  borderRadius: 8,
  padding: 12,
}

const columnHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
  fontWeight: 700,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const badge: React.CSSProperties = {
  background: '#2d3149',
  color: '#94a3b8',
  borderRadius: 10,
  padding: '1px 7px',
  fontSize: 11,
  fontWeight: 700,
}

const card: React.CSSProperties = {
  background: '#0f1117',
  border: '1px solid #2d3149',
  borderRadius: 6,
  padding: '10px 12px',
  marginBottom: 8,
}
