/**
 * SourceHighlight — small inline badge attached to auto-filled form fields.
 * Appears next to a field value to indicate where the data came from.
 */
export function SourceHighlight({ source }: { source: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 8,
        padding: '1px 7px',
        background: '#1a1d27',
        border: '1px solid #6366f1',
        color: '#94a3b8',
        fontSize: 10,
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: 2,
        verticalAlign: 'middle',
        letterSpacing: 0.2,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {source}
    </span>
  )
}
