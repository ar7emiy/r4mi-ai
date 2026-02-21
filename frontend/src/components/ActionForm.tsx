import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import type { Scenario } from '@/pages/CRM'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FieldDef {
  id: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  placeholder?: string
  hint?: string
}

const BILLING_REFUND_FIELDS: FieldDef[] = [
  {
    id: 'refund_amount',
    label: 'Refund Amount ($)',
    type: 'number',
    placeholder: '0.00',
    hint: 'Disputed charge amount from billing table',
  },
  {
    id: 'billing_period',
    label: 'Billing Period',
    type: 'text',
    placeholder: 'e.g. Oct 15 – Nov 14, 2024',
    hint: 'Date range of the disputed charges',
  },
  {
    id: 'eligibility_status',
    label: 'Eligibility Status',
    type: 'select',
    options: [
      { value: '', label: 'Select status...' },
      { value: 'eligible', label: 'Eligible — System error confirmed' },
      { value: 'partially_eligible', label: 'Partially Eligible' },
      { value: 'ineligible', label: 'Ineligible' },
      { value: 'escalate', label: 'Escalate to Supervisor' },
    ],
    hint: 'Based on billing review and policy section 4.2b',
  },
  {
    id: 'routing_decision',
    label: 'Routing Decision',
    type: 'select',
    options: [
      { value: '', label: 'Select routing...' },
      { value: 'auto_approve', label: 'Auto-Approve (≤$500)' },
      { value: 'manual_review', label: 'Manual Review' },
      { value: 'supervisor_approval', label: 'Supervisor Approval ($500–$2K)' },
      { value: 'deny', label: 'Deny with Explanation' },
    ],
    hint: 'Policy threshold: auto-approve ≤$500',
  },
  {
    id: 'agent_notes',
    label: 'Agent Notes',
    type: 'textarea',
    placeholder: 'Summarize the case and decision rationale...',
    hint: 'Include key findings and resolution summary',
  },
]

const CANCELLATION_FIELDS: FieldDef[] = [
  {
    id: 'account_tier',
    label: 'Account Tier',
    type: 'select',
    options: [
      { value: '', label: 'Select tier...' },
      { value: 'basic', label: 'Basic' },
      { value: 'professional', label: 'Professional' },
      { value: 'enterprise_pro', label: 'Enterprise Pro' },
      { value: 'premium_legacy', label: 'Premium Legacy' },
    ],
    hint: 'From customer profile section',
  },
  {
    id: 'remaining_contract_term',
    label: 'Remaining Contract (months)',
    type: 'number',
    placeholder: '0',
    hint: 'Months until contract end date',
  },
  {
    id: 'early_termination_fee',
    label: 'Early Termination Fee ($)',
    type: 'number',
    placeholder: '0.00',
    hint: 'From ETF schedule in contract terms',
  },
  {
    id: 'fee_waiver_applied',
    label: 'Fee Waiver Applied',
    type: 'select',
    options: [
      { value: '', label: 'Select waiver...' },
      { value: 'no_waiver', label: 'No Waiver' },
      { value: 'partial_25pct', label: 'Partial Waiver (25%)' },
      { value: 'partial_50pct', label: 'Partial Waiver (50%)' },
      { value: 'full_waiver', label: 'Full Waiver' },
      { value: 'supervisor_discretion', label: 'Supervisor Discretion' },
    ],
    hint: 'Policy 9.1: tenure >3yr eligible for partial waiver',
  },
  {
    id: 'offboarding_notes',
    label: 'Offboarding Notes',
    type: 'textarea',
    placeholder: 'Cancellation reason, retention attempts, final status...',
    hint: 'Include churn reason and all retention offers made',
  },
]

interface Props {
  scenario: Scenario
  sessionId: string | null
  onFieldChange?: (fieldId: string, value: string) => void
  onFieldFocus?: (fieldId: string) => void
  onFieldBlur?: () => void
  onSubmit?: () => void
  // AG-UI: external values that will be filled programmatically
  externalValues?: Record<string, string>
}

export default function ActionForm({
  scenario,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  onSubmit,
  externalValues
}: Props) {
  const fields = scenario === 'billing_refund' ? BILLING_REFUND_FIELDS : CANCELLATION_FIELDS
  const [values, setValues] = useState<Record<string, string>>({})
  const [activeField, setActiveField] = useState<FieldDef | null>(null)
  const [filling, setFilling] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const prevExternal = useRef<Record<string, string>>({})

  // AG-UI: apply external values with animation
  useEffect(() => {
    if (!externalValues) return
    const newValues = { ...values }
    const newFilling: Record<string, boolean> = {}
    let changed = false

    for (const [key, val] of Object.entries(externalValues)) {
      if (prevExternal.current[key] !== val) {
        newValues[key] = val
        newFilling[key] = true
        changed = true
      }
    }

    if (changed) {
      prevExternal.current = { ...externalValues }
      setValues(newValues)
      setFilling(newFilling)

      // Remove animation class after transition
      setTimeout(() => {
        setFilling({})
      }, 1400)
    }
  }, [externalValues, values])

  function handleChange(fieldId: string, value: string) {
    setValues((v) => ({ ...v, [fieldId]: value }))
    onFieldChange?.(fieldId, value)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit?.()
    setSubmitted(true)
  }

  const progress = fields.filter((f) => values[f.id]).length
  const total = fields.length

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="mb-4 rounded-full bg-emerald-100 p-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Resolution Submitted</h3>
        <p className="text-sm text-muted-foreground mb-4">
          The {scenario === 'billing_refund' ? 'refund request' : 'cancellation'} has been processed and logged.
        </p>
        <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setValues({}) }}>
          New Case
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
          <span>{progress}/{total} fields completed</span>
          <Badge variant={progress === total ? 'success' : 'secondary'} className="text-xs">
            {progress === total ? 'Ready to submit' : `${total - progress} remaining`}
          </Badge>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(progress / total) * 100}%` }}
          />
        </div>
      </div>

      <Separator />

      {/* Guidance Panel */}
      <div className={cn(
        "bg-blue-50/50 px-4 py-2 text-xs border-b transition-all duration-300 overflow-hidden",
        activeField ? "max-h-32 opacity-100" : "max-h-0 opacity-0 border-transparent p-0"
      )}>
        <p className="font-semibold text-blue-900 mb-1">Guidance & Evidence</p>
        <p className="text-blue-800 leading-normal italic">
          {activeField?.hint || "Select a field to see extraction logic."}
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-auto p-4 space-y-5">
        {fields.map((field) => (
          <FormField
            key={field.id}
            field={field}
            value={values[field.id] || ''}
            isAnimating={!!filling[field.id]}
            onChange={(v) => handleChange(field.id, v)}
            onFocus={() => {
              setActiveField(field)
              onFieldFocus?.(field.id)
            }}
            onBlur={() => {
              setActiveField(null)
              onFieldBlur?.()
            }}
          />
        ))}
      </div>

      <Separator />

      {/* Submit */}
      <div className="p-4">
        <Button
          type="submit"
          className="w-full"
          disabled={progress === 0}
        >
          {progress < total ? (
            <><Loader2 className="h-4 w-4 animate-pulse" /> Submit Resolution ({progress}/{total})</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Submit Resolution</>
          )}
        </Button>
        {progress < total && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Complete all fields or submit partial resolution
          </p>
        )}
      </div>
    </form>
  )
}

interface FormFieldProps {
  field: FieldDef
  value: string
  isAnimating: boolean
  onChange: (v: string) => void
  onFocus: () => void
  onBlur: () => void
}

function FormField({ field, value, isAnimating, onChange, onFocus, onBlur }: FormFieldProps) {
  const inputClass = cn(
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-colors',
    isAnimating && 'ag-filling',
  )

  return (
    <div className="space-y-1.5" data-field-id={field.id}>
      <label className="flex items-center gap-2 text-sm font-medium">
        {field.label}
        {value && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
      </label>

      {field.type === 'select' && (
        <select
          id={field.id}
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <textarea
          id={field.id}
          className={cn(inputClass, 'resize-none h-24')}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}

      {(field.type === 'text' || field.type === 'number') && (
        <input
          id={field.id}
          type={field.type}
          className={inputClass}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}

      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
    </div>
  )
}
