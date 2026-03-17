import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export function EvidencePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [showVectors, setShowVectors] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['evidence', sessionId],
    queryFn: () =>
      fetch(`/api/evidence/${sessionId ?? 'session_live'}`).then((r) => r.json()),
    enabled: !!sessionId,
  })

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1117',
        color: '#e2e8f0',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 32,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'transparent',
            border: '1px solid #4a5568',
            color: '#a0aec0',
            padding: '6px 14px',
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          ← Back to App
        </button>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>
          r4mi-ai Evidence Panel
        </div>
        <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 24 }}>
          Full proof for judges: real Gemini embedding calls, cosine similarity matrix,
          and raw vector previews.
        </div>

        {isLoading && <div style={{ color: '#4a5568' }}>Loading evidence...</div>}
        {error && (
          <div style={{ color: '#ef4444' }}>
            No session selected. Submit a permit application first, then visit
            /evidence/[session_id].
          </div>
        )}
        {!sessionId && (
          <div style={{ color: '#94a3b8' }}>
            Provide a session ID in the URL: <code>/evidence/[session_id]</code>
          </div>
        )}

        {data && (
          <>
            {/* Metadata */}
            <div
              style={{
                background: '#1a1d27',
                border: '1px solid #2d3149',
                borderRadius: 6,
                padding: 16,
                marginBottom: 24,
                display: 'flex',
                gap: 32,
                flexWrap: 'wrap',
              }}
            >
              <Stat label="Embedding Model" value={data.embedding_model} />
              <Stat label="Dimensions" value={data.embedding_dims} />
              <Stat label="Similarity Threshold" value={data.similarity_threshold} />
              <Stat label="Permit Type" value={data.permit_type} />
              <Stat label="Sessions Compared" value={data.sessions?.length ?? 0} />
            </div>

            {/* Sessions side by side */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Session Action Traces
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(data.sessions?.length ?? 1, 3)}, 1fr)`,
                gap: 12,
                marginBottom: 24,
              }}
            >
              {(data.sessions ?? []).map((s: any) => (
                <div
                  key={s.session_id}
                  style={{
                    background: '#1a1d27',
                    border: s.session_id === sessionId ? '1px solid #6366f1' : '1px solid #2d3149',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>
                    {s.session_id} {s.is_seeded && <span style={{ color: '#4a5568' }}>(seeded)</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#4a5568', marginBottom: 6 }}>
                    {s.event_count} events · {s.embedding_dims} embedding dims
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>
                    {(s.events ?? []).slice(0, 8).map((e: any, i: number) => (
                      <div key={i}>{e.event_type}:{e.screen_name}</div>
                    ))}
                    {s.event_count > 8 && <div style={{ color: '#4a5568' }}>...+{s.event_count - 8} more</div>}
                  </div>
                  {showVectors && (
                    <div style={{ marginTop: 6, fontSize: 10, fontFamily: 'monospace', color: '#4a5568' }}>
                      [{(s.embedding_preview ?? []).map((v: number) => v.toFixed(4)).join(', ')}...]
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Similarity matrix */}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Cosine Similarity Matrix
            </div>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
                <thead>
                  <tr>
                    <th style={mth}></th>
                    {(data.sessions ?? []).map((s: any) => (
                      <th key={s.session_id} style={mth}>{s.session_id.slice(0, 12)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.similarity_matrix ?? []).map((row: any[], ri: number) => (
                    <tr key={ri}>
                      <td style={{ ...mth, color: '#94a3b8' }}>
                        {(data.sessions?.[ri]?.session_id ?? '').slice(0, 12)}
                      </td>
                      {row.map((score: number | null, ci: number) => (
                        <td
                          key={ci}
                          style={{
                            ...mtd,
                            background:
                              score === null
                                ? '#1a1d27'
                                : ri === ci
                                  ? '#2d3149'
                                  : score >= data.similarity_threshold
                                    ? 'rgba(34,197,94,0.15)'
                                    : '#1a1d27',
                            color:
                              score === null
                                ? '#4a5568'
                                : ri === ci
                                  ? '#4a5568'
                                  : score >= data.similarity_threshold
                                    ? '#4ade80'
                                    : '#ef4444',
                            fontWeight: score !== null && score >= data.similarity_threshold && ri !== ci ? 700 : 400,
                          }}
                        >
                          {score === null ? '—' : score.toFixed(4)}
                          {score !== null && score >= data.similarity_threshold && ri !== ci && ' ✓'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#4ade80' }}>■ Above threshold ({data.similarity_threshold})</span>
              <span style={{ fontSize: 11, color: '#ef4444' }}>■ Below threshold</span>
              <button
                onClick={() => setShowVectors(!showVectors)}
                style={{
                  background: 'transparent',
                  border: '1px solid #2d3149',
                  color: '#94a3b8',
                  padding: '4px 12px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: 11,
                  borderRadius: 4,
                  marginLeft: 'auto',
                }}
              >
                {showVectors ? 'Hide' : 'View'} raw vectors (10 dims)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
    </div>
  )
}

const mth: React.CSSProperties = { padding: '6px 12px', border: '1px solid #2d3149', color: '#94a3b8', textAlign: 'center', fontFamily: 'monospace', fontSize: 10 }
const mtd: React.CSSProperties = { padding: '6px 12px', border: '1px solid #2d3149', textAlign: 'center', fontFamily: 'monospace', fontSize: 11 }
