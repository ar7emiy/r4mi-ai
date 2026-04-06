import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useR4miStore } from '../../store/r4mi.store'



export function ApplicationForm() {
  const activeApplicationId = useR4miStore((s) => s.activeApplicationId)
  const { data: app } = useQuery({
    queryKey: ['application', activeApplicationId],
    queryFn: () =>
      fetch(`/api/stubs/applications/${activeApplicationId}`).then((r) => r.json()),
    enabled: !!activeApplicationId,
  })

  const [zone, setZone] = useState('')
  const [maxHeight, setMaxHeight] = useState('')
  const [fenceHeight, setFenceHeight] = useState('')
  const [varianceRequired, setVarianceRequired] = useState('')
  const [decision, setDecision] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Reset form state when switching to a different application
  useEffect(() => {
    setZone('')
    setMaxHeight('')
    setFenceHeight('')
    setVarianceRequired('')
    setDecision('')
    setNotes('')
    setSubmitted(false)
  }, [activeApplicationId])




  async function handleSubmit() {
    if (!activeApplicationId) return
    const sessionId = `session_live_${Date.now()}`

    // Post events to observer
    const permitType = app?.permit_type ?? 'general'
    const events = [
      { event_type: 'navigate', screen_name: 'APPLICATION_INBOX', element_selector: `app_row_${activeApplicationId}` },
      { event_type: 'screen_switch', screen_name: 'GIS_LOOKUP', element_selector: 'tab_gis' },
      { event_type: 'input', screen_name: 'GIS_LOOKUP', element_selector: 'parcel_id_input', element_value: app?.parcel_id },
      { event_type: 'navigate', screen_name: 'APPLICATION_FORM', element_selector: 'tab_form' },
      { event_type: 'input', screen_name: 'APPLICATION_FORM', element_selector: 'zone_classification', element_value: zone },
      { event_type: 'screen_switch', screen_name: 'POLICY_REFERENCE', element_selector: 'tab_policy' },
      { event_type: 'navigate', screen_name: 'APPLICATION_FORM', element_selector: 'tab_form' },
      { event_type: 'input', screen_name: 'APPLICATION_FORM', element_selector: 'max_permitted_height', element_value: maxHeight },
      { event_type: 'input', screen_name: 'APPLICATION_FORM', element_selector: 'notes', element_value: notes },
      { event_type: 'submit', screen_name: 'APPLICATION_FORM', element_selector: 'submit_btn' },
    ]

    for (const evt of events) {
      await fetch('/api/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          user_id: 'permit-tech-001',
          timestamp: new Date().toISOString(),
          permit_type: permitType,
          ...evt,
        }),
      })
    }

    // Persist submission status in stub backend
    await fetch(`/api/stubs/applications/${activeApplicationId}/submit`, {
      method: 'POST',
    })

    setSubmitted(true)
  }

  if (!activeApplicationId || !app) {
    return (
      <div style={{ color: '#666', fontSize: 12, padding: 16 }}>
        Select an application from the inbox to begin processing.
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 'bold',
            color: '#006600',
            marginBottom: 8,
          }}
        >
          ✓ Application {activeApplicationId} submitted successfully.
        </div>
        <div style={{ fontSize: 12, color: '#666' }}>
          Processing complete. Return to inbox for next application.
        </div>
      </div>
    )
  }

  const permitCfg = getPermitConfig(app?.permit_type)

  return (
    <div>
      <div style={{ ...sectionHeader }}>
        APPLICATION FORM — {activeApplicationId}
      </div>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>APPLICANT INFORMATION</legend>
        <FormRow label="Applicant Name" value={app.applicant} readOnly />
        <FormRow label="Address" value={app.address} readOnly />
        <FormRow label="Parcel ID" value={app.parcel_id} readOnly />
        <FormRow label="Submitted" value={app.submitted} readOnly />
        <FormRow label="Request" value={app.request} readOnly wide />
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>PROPERTY DETAILS</legend>
        <FormRow
          label="Zone Classification"
          value={zone}
          onChange={setZone}
          required
        />
        {permitCfg.showFenceFields && (
          <FormRow
            label="Fence Height Requested"
            value={fenceHeight}
            onChange={setFenceHeight}
            placeholder="ft"
          />
        )}
        <FormRow
          label={permitCfg.constraintLabel}
          value={maxHeight}
          onChange={setMaxHeight}
          required
          placeholder={permitCfg.constraintPlaceholder}
        />
        {permitCfg.showFenceFields && (
          <FormRow
            label="Variance Required"
            value={varianceRequired}
            onChange={setVarianceRequired}
            placeholder="Yes / No"
          />
        )}
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>ASSESSMENT &amp; DECISION</legend>
        <FormRow
          label="Decision"
          value={decision}
          onChange={setDecision}
          placeholder="Approved / Referred / Denied"
        />
      </fieldset>

      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>NOTES</legend>
        <div style={{ padding: '4px 8px' }}>
          <label style={labelStyle}>PROCESSING NOTES:</label>
          <textarea
            data-testid="field-notes"
            className="legacy-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{ width: '100%', marginTop: 2, resize: 'vertical' }}
          />
          
        </div>
      </fieldset>

      <div style={{ padding: '8px 8px', display: 'flex', gap: 8 }}>
        <button className="legacy-btn legacy-btn-primary" onClick={handleSubmit}>
          SUBMIT APPLICATION
        </button>
        <button className="legacy-btn">SAVE DRAFT</button>
        <button className="legacy-btn">PRINT</button>
      </div>
    </div>
  )
}

function FormRow({
  label,
  value,
  onChange,
  readOnly = false,
  required = false,
  placeholder = '',
  wide = false,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  wide?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '3px 8px',
        gap: 8,
      }}
    >
      <label
        style={{
          ...labelStyle,
          width: 180,
          textAlign: 'right',
          paddingTop: 2,
          flexShrink: 0,
        }}
      >
        {label.toUpperCase()}:{required && <span style={{ color: '#cc0000' }}>*</span>}
      </label>
      <div style={{ flex: 1 }}>
        {wide ? (
          <textarea
            className="legacy-input"
            value={value}
            readOnly={readOnly}
            rows={2}
            style={{
              width: '100%',
              background: readOnly ? '#f5f5f5' : '#fffacd',
              resize: 'none',
            }}
          />
        ) : (
          <input
            className="legacy-input"
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            style={{
              width: wide ? '100%' : 200,
              background: readOnly ? '#f5f5f5' : required ? '#fffacd' : '#fff',
            }}
          />
        )}
        
      </div>
    </div>
  )
}

    >
      {tag.source}
    </span>
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

const fieldsetStyle: React.CSSProperties = {
  border: '1px solid #999',
  padding: '8px 4px',
  marginBottom: 10,
  background: '#fafafa',
}

const legendStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  color: '#444',
  padding: '0 4px',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 0.3,
}
