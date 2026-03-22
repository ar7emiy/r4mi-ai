import { useState } from 'react'
import { DemoStep } from '../../store/r4mi.store'

interface Props {
  step: DemoStep
  onApprove: () => void
  onCorrect: (correctedValue: string, reason?: string) => void
}

export function ApprovalGate({ step, onApprove, onCorrect }: Props) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(step.value)
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')

  function handleConfirmCorrection() {
    onCorrect(editValue, reason || undefined)
  }

  return (
    <div
      data-testid="approval-gate"
      style={{
        background: '#1a1d27',
        border: '1px solid #f59e0b',
        borderRadius: 6,
        padding: '12px 14px',
        marginTop: 10,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Field + value display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {step.field}
        </span>
        <span style={{ color: '#6366f1', fontSize: 11 }}>→</span>
        {editing ? (
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            autoFocus
            style={{
              background: '#0f1117',
              border: '1px solid #6366f1',
              borderRadius: 3,
              color: '#e2e8f0',
              fontSize: 13,
              fontWeight: 600,
              padding: '2px 8px',
              fontFamily: 'inherit',
              width: 140,
            }}
          />
        ) : (
          <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{step.value}</span>
        )}
        {step.source_tag && (
          <span
            style={{
              fontSize: 10,
              color: '#22c55e',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 3,
              padding: '1px 6px',
              marginLeft: 'auto',
            }}
          >
            {step.source_tag}
          </span>
        )}
      </div>

      {/* Correction reason popup */}
      {editing && showReason && (
        <div style={{ marginBottom: 10 }}>
          <input
            placeholder="What was wrong? (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              background: '#0f1117',
              border: '1px solid #2d3149',
              borderRadius: 3,
              color: '#94a3b8',
              fontSize: 12,
              padding: '6px 8px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!editing ? (
          <>
            <button
              data-testid="approval-gate-approve"
              onClick={onApprove}
              style={approveBtn}
            >
              Looks good — continue
            </button>
            <button
              onClick={() => { setEditing(true); setShowReason(false) }}
              style={changeBtn}
            >
              Change
            </button>
          </>
        ) : (
          <>
            {!showReason ? (
              <>
                <button onClick={() => setShowReason(true)} style={approveBtn}>
                  Confirm correction
                </button>
                <button onClick={() => { setEditing(false); setEditValue(step.value) }} style={changeBtn}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button onClick={handleConfirmCorrection} style={approveBtn}>
                  Save correction
                </button>
                <button
                  onClick={handleConfirmCorrection}
                  style={{ ...changeBtn, fontSize: 11 }}
                >
                  Skip reason
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const approveBtn: React.CSSProperties = {
  background: '#6366f1',
  border: 'none',
  color: '#fff',
  padding: '6px 14px',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 700,
  borderRadius: 4,
  flex: 1,
}

const changeBtn: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #2d3149',
  color: '#94a3b8',
  padding: '6px 14px',
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 12,
  borderRadius: 4,
}
