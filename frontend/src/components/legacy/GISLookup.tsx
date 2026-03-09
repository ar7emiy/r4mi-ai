import { useState } from 'react'
import { useR4miStore } from '../../store/r4mi.store'

interface GISResult {
  parcel_id: string
  zone_classification: string
  zone_description: string
  lot_size_sqft?: number
  setback_rear_ft?: number
  building_frontage_ft?: number
  year_built?: number
  structure_type?: string
  adu_permitted?: boolean
  bedrooms?: number
}

export function GISLookup() {
  const [parcelId, setParcelId] = useState('')
  const [result, setResult] = useState<GISResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const demoMode = useR4miStore((s) => s.demoMode)

  async function handleSearch() {
    if (!parcelId.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/stubs/gis/${encodeURIComponent(parcelId.trim())}`)
      if (!res.ok) {
        setError(`Parcel ID not found: ${parcelId}`)
        return
      }
      setResult(await res.json())
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={sectionHeader}>GIS PARCEL LOOKUP</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={labelStyle}>ENTER PARCEL ID: *</label>
        <input
          className="legacy-input"
          value={parcelId}
          onChange={(e) => setParcelId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ width: 180 }}
          placeholder="e.g. R2-0041-BW"
        />
        <button className="legacy-btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div style={{ color: '#cc0000', fontSize: 11, marginBottom: 8 }}>{error}</div>}

      {result && (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={subHeader}>PARCEL INFORMATION</div>
            <div
              style={{
                border: '1px solid #999',
                padding: 10,
                fontFamily: 'monospace',
                fontSize: 12,
                background: '#fafafa',
                lineHeight: 1.8,
              }}
            >
              <div>
                <strong>Parcel ID:</strong> {result.parcel_id}
              </div>
              <div>
                <strong>Zone Classification:</strong>{' '}
                <span style={{ color: '#003478', fontWeight: 'bold' }}>
                  {result.zone_classification}
                </span>{' '}
                ({result.zone_description})
              </div>
              {result.lot_size_sqft && (
                <div>
                  <strong>Lot Size:</strong> {result.lot_size_sqft.toLocaleString()} sq ft
                </div>
              )}
              {result.setback_rear_ft && (
                <div>
                  <strong>Setback (rear):</strong> {result.setback_rear_ft} ft
                </div>
              )}
              {result.building_frontage_ft && (
                <div>
                  <strong>Building Frontage:</strong> {result.building_frontage_ft} linear ft
                </div>
              )}
              {result.year_built && (
                <div>
                  <strong>Year Built:</strong> {result.year_built}
                </div>
              )}
              {result.structure_type && (
                <div>
                  <strong>Structure Type:</strong> {result.structure_type}
                </div>
              )}
              {result.adu_permitted !== null && result.adu_permitted !== undefined && (
                <div>
                  <strong>ADU Permitted:</strong> {result.adu_permitted ? 'Yes' : 'No'}
                </div>
              )}
              {result.bedrooms && (
                <div>
                  <strong>Bedrooms:</strong> {result.bedrooms}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              width: 240,
              height: 180,
              border: '1px solid #999',
              background: '#d8d8d8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              fontSize: 12,
              fontFamily: 'Arial',
            }}
          >
            [ MAP VIEW ]
          </div>
        </div>
      )}

      {demoMode && result && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            border: '2px dashed #dc2626',
            fontSize: 11,
            color: '#dc2626',
          }}
        >
          DEMONSTRATION MODE: Click on the data you want r4mi-ai to use as a source
        </div>
      )}
    </div>
  )
}

const sectionHeader: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'bold',
  color: '#003478',
  marginBottom: 10,
  borderBottom: '2px solid #003478',
  paddingBottom: 4,
}

const subHeader: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  color: '#444',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}
