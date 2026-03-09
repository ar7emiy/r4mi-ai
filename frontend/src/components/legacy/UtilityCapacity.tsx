import { useState } from 'react'

export function UtilityCapacity() {
  const [block, setBlock] = useState('')
  const [sewer, setSewer] = useState<any>(null)
  const [water, setWater] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (!block.trim()) return
    setLoading(true)
    setError(null)
    setSewer(null)
    setWater(null)
    try {
      const [sr, wr] = await Promise.all([
        fetch(`/api/stubs/sewer/${encodeURIComponent(block.trim())}`),
        fetch(`/api/stubs/water/${encodeURIComponent(block.trim())}`),
      ])
      if (sr.ok) setSewer(await sr.json())
      if (wr.ok) setWater(await wr.json())
      if (!sr.ok && !wr.ok) setError('Block not found')
    } catch { setError('Connection error') } finally { setLoading(false) }
  }

  const bindingEDU = sewer && water
    ? Math.min(sewer.available_edu, water.available_edu)
    : null

  return (
    <div>
      <div style={sectionHeader}>UTILITY CAPACITY — SEWER &amp; WATER</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>BLOCK ID: *</label>
        <input className="legacy-input" value={block}
          onChange={(e) => setBlock(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ width: 220 }} placeholder="e.g. ELM-ST-800-900" />
        <button className="legacy-btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      {error && <div style={{ color: '#cc0000', fontSize: 11 }}>{error}</div>}
      {(sewer || water) && (
        <div style={{ display: 'flex', gap: 16 }}>
          {sewer && (
            <div style={panelStyle}>
              <div style={panelHeader}>SEWER CAPACITY</div>
              <div style={dataStyle}><strong>Block:</strong> {sewer.block}</div>
              <div style={dataStyle}><strong>Current Load:</strong> {sewer.current_load_pct}%</div>
              <div style={dataStyle}><strong>Available EDU:</strong> <span style={{ color: sewer.available_edu < 2 ? '#cc0000' : '#006600', fontWeight: 'bold' }}>{sewer.available_edu}</span></div>
              <div style={dataStyle}><strong>Last Assessment:</strong> {sewer.last_assessment}</div>
            </div>
          )}
          {water && (
            <div style={panelStyle}>
              <div style={panelHeader}>WATER CAPACITY</div>
              <div style={dataStyle}><strong>Block:</strong> {water.block}</div>
              <div style={dataStyle}><strong>Current Load:</strong> {water.current_load_pct}%</div>
              <div style={dataStyle}><strong>Available EDU:</strong> <span style={{ color: water.available_edu < 2 ? '#cc0000' : '#006600', fontWeight: 'bold' }}>{water.available_edu}</span></div>
              <div style={dataStyle}><strong>Last Assessment:</strong> {water.last_assessment}</div>
            </div>
          )}
          {bindingEDU !== null && (
            <div style={{ ...panelStyle, background: '#fffacd', borderColor: '#888' }}>
              <div style={panelHeader}>BINDING CAPACITY</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#003478', padding: '8px 0' }}>{bindingEDU} EDU</div>
              <div style={{ fontSize: 11, color: '#666' }}>Lower of sewer/water available</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const sectionHeader: React.CSSProperties = { fontSize: 13, fontWeight: 'bold', color: '#003478', marginBottom: 10, borderBottom: '2px solid #003478', paddingBottom: 4 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }
const panelStyle: React.CSSProperties = { border: '1px solid #999', padding: 10, background: '#fafafa', minWidth: 180 }
const panelHeader: React.CSSProperties = { fontSize: 11, fontWeight: 'bold', color: '#003478', marginBottom: 6, borderBottom: '1px solid #ccc', paddingBottom: 2, textTransform: 'uppercase' }
const dataStyle: React.CSSProperties = { fontSize: 12, fontFamily: 'monospace', lineHeight: 1.8 }
