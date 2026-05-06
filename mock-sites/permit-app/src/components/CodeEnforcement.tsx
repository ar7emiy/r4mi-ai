import { useState } from 'react'

export function CodeEnforcement() {
  const [parcelId, setParcelId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (!parcelId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/stubs/code-enforcement/${encodeURIComponent(parcelId.trim())}`,
      )
      if (!res.ok) { setError('Parcel not found'); return }
      setResult(await res.json())
    } catch { setError('Connection error') } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={sectionHeader}>CODE ENFORCEMENT — VIOLATION HISTORY</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>PARCEL ID: *</label>
        <input className="legacy-input" value={parcelId}
          onChange={(e) => setParcelId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ width: 180 }} placeholder="e.g. I1-0117-IP" />
        <button className="legacy-btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <div style={{ color: '#cc0000', fontSize: 11 }}>{error}</div>}
      {result && (
        <div>
          <div style={subHeader}>
            Open Violations: <span style={{ color: result.open_violations.length > 0 ? '#cc0000' : '#006600' }}>
              {result.open_violations.length}
            </span>
          </div>
          {result.open_violations.length > 0 && (
            <table style={tableStyle}>
              <thead><tr style={theadStyle}>
                <th style={thStyle}>ID</th><th style={thStyle}>DESCRIPTION</th>
                <th style={thStyle}>ISSUED</th><th style={thStyle}>STATUS</th>
              </tr></thead>
              <tbody>
                {result.open_violations.map((v: any) => (
                  <tr key={v.id}>
                    <td style={tdStyle}>{v.id}</td>
                    <td style={tdStyle}>{v.description}</td>
                    <td style={tdStyle}>{v.issued}</td>
                    <td style={{ ...tdStyle, color: '#cc0000', fontWeight: 'bold' }}>OPEN</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ ...subHeader, marginTop: 12 }}>
            Resolved Violations: {result.resolved_violations.length}
          </div>
          {result.resolved_violations.length > 0 && (
            <table style={tableStyle}>
              <thead><tr style={theadStyle}>
                <th style={thStyle}>ID</th><th style={thStyle}>DESCRIPTION</th>
                <th style={thStyle}>ISSUED</th><th style={thStyle}>RESOLVED</th>
              </tr></thead>
              <tbody>
                {result.resolved_violations.map((v: any) => (
                  <tr key={v.id}>
                    <td style={tdStyle}>{v.id}</td>
                    <td style={tdStyle}>{v.description}</td>
                    <td style={tdStyle}>{v.issued}</td>
                    <td style={{ ...tdStyle, color: '#006600' }}>{v.resolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const sectionHeader: React.CSSProperties = { fontSize: 13, fontWeight: 'bold', color: '#003478', marginBottom: 10, borderBottom: '2px solid #003478', paddingBottom: 4 }
const subHeader: React.CSSProperties = { fontSize: 12, fontWeight: 'bold', marginBottom: 6 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 }
const theadStyle: React.CSSProperties = { background: '#003478', color: '#fff' }
const thStyle: React.CSSProperties = { padding: '4px 8px', border: '1px solid #00245a', fontSize: 11 }
const tdStyle: React.CSSProperties = { padding: '3px 8px', border: '1px solid #ccc' }
