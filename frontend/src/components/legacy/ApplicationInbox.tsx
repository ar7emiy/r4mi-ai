import { useQuery } from '@tanstack/react-query'
import { useR4miStore } from '../../store/r4mi.store'

interface Application {
  application_id: string
  applicant: string
  address: string
  permit_type: string
  submitted: string
  status: string
}

const TYPE_LABELS: Record<string, string> = {
  fence_variance: 'Fence Variance',
  adu_addition: 'ADU Addition',
  commercial_signage: 'Commercial Signage',
  demolition: 'Demolition',
  str_registration: 'STR Registration',
  general: 'General',
}

export function ApplicationInbox({ onSelectApp }: { onSelectApp: () => void }) {
  const setActiveApplicationId = useR4miStore((s) => s.setActiveApplicationId)
  const activeApplicationId = useR4miStore((s) => s.activeApplicationId)
  const publishedAgents = useR4miStore((s) => s.publishedAgents)
  const clearDemoSteps = useR4miStore((s) => s.clearDemoSteps)

  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: ['applications'],
    queryFn: () => fetch('/api/stubs/applications').then((r) => r.json()),
  })

  function handleRowClick(app: Application) {
    clearDemoSteps()
    setActiveApplicationId(app.application_id)

    const match = publishedAgents.find((a) => a.permit_type === app.permit_type)
    if (match) {
      fetch(`/api/agents/${match.id}/run?application_id=${app.application_id}`, {
        method: 'POST',
      })
    }

    onSelectApp()
  }

  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 'bold',
          color: '#003478',
          marginBottom: 8,
          borderBottom: '2px solid #003478',
          paddingBottom: 4,
        }}
      >
        APPLICATION INBOX — PENDING REVIEW QUEUE
      </div>

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
              {['APP ID', 'APPLICANT', 'ADDRESS', 'TYPE', 'SUBMITTED', 'STATUS'].map(
                (h) => (
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
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {apps.map((app, i) => (
              <tr
                key={app.application_id}
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
                          : app.status === 'Approved'
                            ? '#006600'
                            : '#000',
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
        {apps.length} record(s) found. Click a row to open the application.
      </div>
    </div>
  )
}

const tdStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #ccc',
  verticalAlign: 'middle',
}
