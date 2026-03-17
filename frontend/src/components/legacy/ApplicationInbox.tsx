import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useR4miStore } from '../../store/r4mi.store'

interface Application {
  application_id: string
  applicant: string
  address: string
  permit_type: string
  submitted: string
  status: string
  request?: string
}

const TYPE_LABELS: Record<string, string> = {
  fence_variance: 'Fence Variance',
  adu_addition: 'ADU Addition',
  commercial_signage: 'Commercial Signage',
  demolition: 'Demolition',
  str_registration: 'STR Registration',
  solar_permit: 'Solar Panel',
  home_occupation: 'Home Occupation',
  tree_removal: 'Tree Removal',
  deck_permit: 'Deck Permit',
  general: 'General',
}

const WORKFLOWS = [
  {
    type: 'fence_variance',
    label: 'Fence Variance',
    steps: [
      'Click any Fence Variance row',
      'GIS tab → copy Zone Classification (e.g. "R-2") into the form',
      'Policy Ref tab → §14.3 → enter "6 ft" in Max Permitted Height',
      'Submit Application',
    ],
  },
  {
    type: 'solar_permit',
    label: 'Solar Panel',
    steps: [
      'Click any Solar Panel row',
      'GIS tab → copy Zone Classification (e.g. "R-2") into the form',
      'Policy Ref tab → §22.1 → enter "20 kW" in Max System Size',
      'Submit Application',
    ],
  },
  {
    type: 'home_occupation',
    label: 'Home Business',
    steps: [
      'Click any Home Business row',
      'GIS tab → copy Zone Classification (e.g. "R-2") into the form',
      'Policy Ref tab → §18.4 → enter "Allowed" in Allowed Use Finding',
      'Submit Application',
    ],
  },
  {
    type: 'tree_removal',
    label: 'Tree Removal',
    steps: [
      'Click any Tree Removal row',
      'GIS tab → copy Zone Classification (e.g. "R-2") into the form',
      'Policy Ref tab → §9.7 → enter "1:1" in Replacement Ratio',
      'Submit Application',
    ],
  },
  {
    type: 'deck_permit',
    label: 'Deck Permit',
    steps: [
      'Click any Deck Permit row',
      'GIS tab → copy Zone Classification (e.g. "R-2") into the form',
      'Policy Ref tab → §16.2 → enter "30 in" in Max Deck Height',
      'Submit Application',
    ],
  },
]

const PERMIT_TYPES = Object.entries(TYPE_LABELS).filter(([k]) => k !== 'general')

export function ApplicationInbox({ onSelectApp }: { onSelectApp: () => void }) {
  const setActiveApplicationId = useR4miStore((s) => s.setActiveApplicationId)
  const activeApplicationId = useR4miStore((s) => s.activeApplicationId)
  const clearDemoSteps = useR4miStore((s) => s.clearDemoSteps)
  const queryClient = useQueryClient()

  const [showPsst, setShowPsst] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newApplicant, setNewApplicant] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newPermitType, setNewPermitType] = useState('fence_variance')
  const [newRequest, setNewRequest] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => fetch('/api/stubs/applications').then((r) => r.json()),
  })

  function handleRowClick(app: Application) {
    clearDemoSteps()
    setActiveApplicationId(app.application_id)
    onSelectApp()
  }

  function handleWorkflowClick(type: string) {
    setFilterType(filterType === type ? null : type)
    setShowNewForm(false)
  }

  async function handleCreateApp() {
    if (!newApplicant.trim() || !newAddress.trim() || !newRequest.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/stubs/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicant: newApplicant.trim(),
          address: newAddress.trim(),
          permit_type: newPermitType,
          request: newRequest.trim(),
        }),
      })
      if (res.ok) {
        const newApp = await res.json()
        queryClient.invalidateQueries({ queryKey: ['applications'] })
        setNewApplicant('')
        setNewAddress('')
        setNewRequest('')
        setNewPermitType('fence_variance')
        setShowNewForm(false)
        // Auto-filter to the newly created type so the user sees it
        setFilterType(newApp.permit_type)
        clearDemoSteps()
        setActiveApplicationId(newApp.application_id)
        onSelectApp()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredApps = filterType ? apps.filter((a) => a.permit_type === filterType) : apps

  return (
    <div>
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
          fontWeight: 'bold',
          color: '#003478',
          marginBottom: 6,
          borderBottom: '2px solid #003478',
          paddingBottom: 4,
        }}
      >
        <span>APPLICATION INBOX — PENDING REVIEW QUEUE</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              setShowPsst(!showPsst)
              setShowNewForm(false)
            }}
            style={{
              background: showPsst ? '#003478' : '#fffbea',
              border: `1px solid ${showPsst ? '#003478' : '#c0a000'}`,
              color: showPsst ? '#fff' : '#7a5c00',
              padding: '2px 8px',
              fontSize: 11,
              fontStyle: 'italic',
              cursor: 'pointer',
              borderRadius: 2,
            }}
            title="Guided workflow suggestions"
          >
            {showPsst ? '▲ hide' : 'psst... try these workflows'}
          </button>
          <button
            onClick={() => {
              setShowNewForm(!showNewForm)
              setShowPsst(false)
            }}
            style={{
              background: showNewForm ? '#003478' : '#e8edf5',
              border: '1px solid #003478',
              color: showNewForm ? '#fff' : '#003478',
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: 2,
            }}
            title="Submit your own application"
          >
            + New
          </button>
        </div>
      </div>

      {/* ── psst panel ── */}
      {showPsst && (
        <div
          style={{
            background: '#fffbea',
            border: '1px dashed #c0a000',
            padding: '8px 10px',
            marginBottom: 8,
            fontSize: 11,
          }}
        >
          <div style={{ color: '#5a4000', marginBottom: 6, lineHeight: 1.4, fontSize: 11 }}>
            Each workflow has <strong>2 prior sessions already processed</strong> — one more and
            your narrow AI agent is born. Pick one to see the exact steps.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WORKFLOWS.map((w) => {
              const count = apps.filter((a) => a.permit_type === w.type).length
              const active = filterType === w.type
              return (
                <button
                  key={w.type}
                  onClick={() => handleWorkflowClick(w.type)}
                  style={{
                    background: active ? '#003478' : '#e8edf5',
                    border: '1px solid #003478',
                    color: active ? '#fff' : '#003478',
                    padding: '3px 9px',
                    fontSize: 11,
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontWeight: active ? 'bold' : 'normal',
                  }}
                >
                  {w.label} ({count})
                </button>
              )
            })}
          </div>
          {filterType && (() => {
            const wf = WORKFLOWS.find((w) => w.type === filterType)
            return wf ? (
              <ol style={{ margin: '8px 0 0 0', paddingLeft: 18, color: '#3a2800', fontSize: 11, lineHeight: 1.7 }}>
                {wf.steps.map((step, i) => (
                  <li key={i} style={{ fontWeight: i === wf.steps.length - 1 ? 'bold' : 'normal' }}>
                    {step}
                  </li>
                ))}
              </ol>
            ) : null
          })()}
        </div>
      )}

      {/* ── New Application inline form ── */}
      {showNewForm && (
        <div
          style={{
            background: '#f5f5f5',
            border: '1px solid #999',
            padding: 10,
            marginBottom: 8,
            fontSize: 12,
          }}
        >
          <div
            style={{
              fontWeight: 'bold',
              fontSize: 12,
              color: '#003478',
              marginBottom: 8,
              borderBottom: '1px solid #ccc',
              paddingBottom: 4,
            }}
          >
            NEW APPLICATION SUBMISSION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
            <div>
              <label style={newFormLabelStyle}>APPLICANT NAME:*</label>
              <input
                className="legacy-input"
                value={newApplicant}
                onChange={(e) => setNewApplicant(e.target.value)}
                placeholder="Full name or company"
                style={{ width: '100%', background: '#fffacd' }}
              />
            </div>
            <div>
              <label style={newFormLabelStyle}>ADDRESS:*</label>
              <input
                className="legacy-input"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Street address"
                style={{ width: '100%', background: '#fffacd' }}
              />
            </div>
            <div>
              <label style={newFormLabelStyle}>PERMIT TYPE:*</label>
              <select
                className="legacy-input"
                value={newPermitType}
                onChange={(e) => setNewPermitType(e.target.value)}
                style={{ width: '100%' }}
              >
                {PERMIT_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={newFormLabelStyle}>REQUEST DESCRIPTION:*</label>
              <input
                className="legacy-input"
                value={newRequest}
                onChange={(e) => setNewRequest(e.target.value)}
                placeholder="Brief description of request"
                style={{ width: '100%', background: '#fffacd' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button
              className="legacy-btn legacy-btn-primary"
              onClick={handleCreateApp}
              disabled={submitting || !newApplicant.trim() || !newAddress.trim() || !newRequest.trim()}
            >
              {submitting ? 'ADDING...' : 'ADD TO INBOX'}
            </button>
            <button className="legacy-btn" onClick={() => setShowNewForm(false)}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ── Active filter indicator ── */}
      {filterType && (
        <div style={{ fontSize: 11, color: '#006600', marginBottom: 4 }}>
          Filtered: <strong>{TYPE_LABELS[filterType]}</strong> — {filteredApps.length} of{' '}
          {apps.length} records.{' '}
          <button
            onClick={() => setFilterType(null)}
            style={{
              border: 'none',
              background: 'none',
              color: '#cc0000',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <div style={{ fontSize: 12, color: '#666', padding: 8 }}>Loading...</div>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            fontFamily: 'Arial',
          }}
        >
          <thead>
            <tr style={{ background: '#003478', color: '#fff' }}>
              {['APP ID', 'APPLICANT', 'ADDRESS', 'TYPE', 'SUBMITTED', 'STATUS'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '4px 8px',
                    textAlign: 'left',
                    border: '1px solid #00245a',
                    fontSize: 11,
                    fontWeight: 'bold',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredApps.map((app, i) => (
              <tr
                key={app.application_id}
                data-testid={`app-row-${app.application_id}`}
                onClick={() => handleRowClick(app)}
                style={{
                  background:
                    app.application_id === activeApplicationId
                      ? '#e8f0fe'
                      : i % 2 === 0
                        ? '#fff'
                        : '#f5f5f5',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (app.application_id !== activeApplicationId)
                    (e.currentTarget as HTMLTableRowElement).style.background = '#e8f0fe'
                }}
                onMouseLeave={(e) => {
                  if (app.application_id !== activeApplicationId)
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      i % 2 === 0 ? '#fff' : '#f5f5f5'
                }}
              >
                <td style={tdStyle}>
                  <span style={{ color: '#003478', textDecoration: 'underline' }}>
                    {app.application_id}
                  </span>
                </td>
                <td style={tdStyle}>{app.applicant}</td>
                <td style={tdStyle}>{app.address}</td>
                <td style={tdStyle}>{TYPE_LABELS[app.permit_type] ?? app.permit_type}</td>
                <td style={tdStyle}>{app.submitted}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      color:
                        app.status === 'Pending Review'
                          ? '#885500'
                          : app.status === 'Approved' || app.status === 'Submitted'
                            ? '#006600'
                            : '#000',
                      fontWeight: app.status === 'Submitted' ? 'bold' : 'normal',
                    }}
                  >
                    {app.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: '#666' }}>
        {filterType
          ? `${filteredApps.length} of ${apps.length} record(s) shown (filtered by ${TYPE_LABELS[filterType]}).`
          : `${apps.length} record(s) found.`}{' '}
        Click a row to open the application.
      </div>
    </div>
  )
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #ccc',
  verticalAlign: 'middle',
}

const newFormLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  color: '#444',
  marginBottom: 2,
}
