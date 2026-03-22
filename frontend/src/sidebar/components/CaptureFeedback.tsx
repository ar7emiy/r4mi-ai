interface Props {
  isRecording: boolean
  narration: string | null
  lastAction: string | null
  lastScreenshot: string | null
}

export function CaptureFeedback({ isRecording, narration, lastAction, lastScreenshot }: Props) {
  if (!isRecording) return null

  return (
    <div style={panel}>
      <div style={panelHeader}>
        <span style={recDot} />
        Capture Log
      </div>

      <div style={row}>
        <span style={icon}>🎤</span>
        <span style={label}>Voice:</span>
        <span style={narration ? valueStyle : dimStyle}>
          {narration ?? 'listening...'}
        </span>
      </div>

      <div style={row}>
        <span style={icon}>🖱</span>
        <span style={label}>Last:</span>
        <span style={lastAction ? valueStyle : dimStyle}>
          {lastAction ?? '—'}
        </span>
      </div>

      {lastScreenshot && (
        <div style={{ marginTop: 6 }}>
          <img
            src={lastScreenshot}
            alt="last capture"
            style={{
              width: 80,
              height: 'auto',
              borderRadius: 3,
              border: '1px solid #dc2626',
              display: 'block',
            }}
          />
        </div>
      )}
    </div>
  )
}

const panel: React.CSSProperties = {
  background: '#1a1d27',
  borderTop: '1px solid #dc2626',
  padding: '8px 12px',
  flexShrink: 0,
}

const panelHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  fontWeight: 700,
  color: '#dc2626',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
}

const recDot: React.CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#dc2626',
  animation: 'pulse-rec 1.5s ease-in-out infinite',
}

const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 4,
  marginBottom: 3,
}

const icon: React.CSSProperties = {
  fontSize: 10,
  flexShrink: 0,
  lineHeight: 1.6,
}

const label: React.CSSProperties = {
  fontSize: 10,
  color: '#4a5568',
  fontWeight: 600,
  flexShrink: 0,
  lineHeight: 1.6,
  minWidth: 30,
}

const valueStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#e2e8f0',
  lineHeight: 1.5,
  wordBreak: 'break-word',
}

const dimStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#374151',
  lineHeight: 1.5,
  fontStyle: 'italic',
}
