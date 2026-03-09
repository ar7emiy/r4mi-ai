import { useState } from 'react'

export function OwnerRegistry() {
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
        `/api/stubs/owner-registry/${encodeURIComponent(parcelId.trim())}`,
      )
      if (!res.ok) { setError('Parcel not found'); return }
      setResult(await res.json())
    } catch { setError('Connection error') } finally { setLoading(false) }
  }

  return (
    <div>
      <div style={sectionHeader}>OWNER REGISTRY — PARCEL OWNERSHIP LOOKUP</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>PARCEL ID: *</label>
        <input className="legacy-input" value={parcelId}
          onChange={(e) => setParcelId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ width: 180 }} placeholder="e.g. R2-0134-LV" />
        <button className="legacy-btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <div style={{ color: '#cc0000', fontSize: 11 }}>{error}</div>}
      {result && (
        <div style={{ border: '1px solid #999', padding: 12, fontFamily: 'monospace', fontSize: 12, background: '#fafafa', lineHeight: 1.8 }}>
          <div><strong>Parcel:</strong> {result.parcel_id}</div>
          <div><strong>Recorded Owner:</strong> <span style={{ color: '#003478', fontWeight: 'bold' }}>{result.recorded_owner}</span></div>
          <div><strong>Owner Address on File:</strong> {result.owner_address}</div>
          <div><strong>Owner-Occupied:</strong>{' '}
            <span style={{ color: result.owner_occupied ? '#006600' : '#cc0000', fontWeight: 'bold' }}>
              {result.owner_occupied ? 'YES' : 'NO'}
            </span>{' '}
            — {result.owner_match_note}
          </div>
        </div>
      )}
    </div>
  )
}

const sectionHeader: React.CSSProperties = { fontSize: 13, fontWeight: 'bold', color: '#003478', marginBottom: 10, borderBottom: '2px solid #003478', paddingBottom: 4 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }
