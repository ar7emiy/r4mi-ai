import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useR4miStore } from '../../store/r4mi.store'

interface SourceTag {
  field: string
  value: string
  source: string
}

const TYPING_DELAY_MS = 60

async function typeValue(
  value: string,
  setter: (v: string) => void,
): Promise<void> {
  for (let i = 0; i <= value.length; i++) {
    setter(value.slice(0, i))
    await new Promise((r) => setTimeout(r, TYPING_DELAY_MS))
  }
}

export function ApplicationForm() {
  const activeApplicationId = useR4miStore((s) => s.activeApplicationId)
  const demoSteps = useR4miStore((s) => s.demoSteps)
  const publishedAgents = useR4miStore((s) => s.publishedAgents)
  const clearDemoSteps = useR4miStore((s) => s.clearDemoSteps)

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
  const [sourceTags, setSourceTags] = useState<SourceTag[]>([])
  const [submitted, setSubmitted] = useState(false)

  // Apply demo step auto-fill with typing animation
  useEffect(() => {
    if (demoSteps.length === 0) return
    const latestStep = demoSteps[demoSteps.length - 1]
    const field = latestStep.field?.toLowerCase() ?? ''

    async function apply() {
      if (field.includes('zone')) {
        await typeValue(latestStep.value, setZone)
        setSourceTags((prev) => [
          ...prev.filter((t) => t.field !== 'zone'),
          { field: 'zone', value: latestStep.value, source: latestStep.source_tag },
        ])
      } else if (field.includes('note') || field.includes('decision')) {
        await typeValue(latestStep.value, setNotes)
        setSourceTags((prev) => [
          ...prev.filter((t) => t.field !== 'notes'),
          { field: 'notes', value: latestStep.value, source: latestStep.source_tag },
        ])
      } else if (field.includes('height') || field.includes('max')) {
        await typeValue(latestStep.value, setMaxHeight)
        setSourceTags((prev) => [
          ...prev.filter((t) => t.field !== 'max_height'),
          { field: 'max_height', value: latestStep.value, source: latestStep.source_tag },
        ])
      }
    }
    apply()
  }, [demoSteps])

  function getSourceTag(field: string) {
    return sourceTags.find((t) => t.field === field)
  }

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

  const match = app && publishedAgents.find((a) => a.permit_type === app.permit_type)

  function handleAutomate() {
    if (match && activeApplicationId) {
      clearDemoSteps()
      fetch(`/api/agents/${match.id}/run?application_id=${activeApplicationId}`, {
        method: 'POST',
      })
    }
  }

  return (
    <div>
      <div style={{ ...sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>APPLICATION FORM — {activeApplicationId}</span>
        {match && (
          <button
            onClick={handleAutomate}
            style={{
              background: '#22c55e',
              border: 'none',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            title={`Run ${match.name}`}
          >
            ⚡ Automate
          </button>
        )}
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
          sourceTag={getSourceTag('zone')}
          testId="field-zone"
        />
        <FormRow
          label="Fence Height Requested"
          value={fenceHeight}
          onChange={setFenceHeight}
          placeholder="ft"
        />
        <FormRow
          label="Max Permitted Height"
          value={maxHeight}
          onChange={setMaxHeight}
          required
          placeholder="ft"
          sourceTag={getSourceTag('max_height')}
          testId="field-max-height"
        />
        <FormRow
          label="Variance Required"
          value={varianceRequired}
          onChange={setVarianceRequired}
          placeholder="Yes / No"
        />
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
          {getSourceTag('notes') && <SourceTagBadge tag={getSourceTag('notes')!} />}
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
  sourceTag,
  testId,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  required?: boolean
  placeholder?: string
  wide?: boolean
  sourceTag?: { field: string; value: string; source: string }
  testId?: string
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
            data-testid={testId}
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
        {sourceTag && <SourceTagBadge tag={sourceTag} />}
      </div>
    </div>
  )
}

function SourceTagBadge({ tag }: { tag: { source: string } }) {
  return (
    <span
      style={{
        display: 'inline-block',
        marginLeft: 6,
        padding: '1px 6px',
        background: '#1a1d27',
        border: '1px solid #6366f1',
        color: '#94a3b8',
        fontSize: 10,
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: 2,
        verticalAlign: 'middle',
      }}
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
