interface Props {
  isRecording: boolean
  onToggle: () => void
}

export function RecordButton({ isRecording, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      style={{
        ...btn,
        background: isRecording ? 'rgba(220, 38, 38, 0.1)' : 'transparent',
        color: isRecording ? '#dc2626' : '#94a3b8',
        border: `1px solid ${isRecording ? '#dc2626' : '#2d3149'}`,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isRecording ? '#dc2626' : '#4a5568',
          display: 'inline-block',
          marginRight: 6,
          animation: isRecording ? 'pulse-rec 1.5s infinite' : 'none',
        }}
      />
      {isRecording ? 'Stop Recording' : 'Record Workflow'}
      <style>{`@keyframes pulse-rec { 0%,100% { opacity: .5; } 50% { opacity: 1; } }`}</style>
    </button>
  )
}

const btn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'Inter, system-ui, sans-serif',
  display: 'flex',
  alignItems: 'center',
}
