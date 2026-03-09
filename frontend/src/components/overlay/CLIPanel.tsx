import { useEffect, useRef } from 'react'
import { useLogs } from '../../hooks/useLogs'

export function CLIPanel() {
  const lines = useLogs(300)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  function colorLine(line: string): React.CSSProperties {
    if (line.includes('[Embedding]')) return { color: '#818cf8' }
    if (line.includes('[Vision]')) return { color: '#a78bfa' }
    if (line.includes('[Similarity]')) return { color: '#34d399' }
    if (line.includes('[Detector]')) return { color: '#fbbf24' }
    if (line.includes('[SSE]')) return { color: '#6366f1' }
    if (line.includes('[SpecBuilder]')) return { color: '#f472b6' }
    if (line.includes('[Agentverse]')) return { color: '#22c55e' }
    if (line.includes('[Observer]')) return { color: '#94a3b8' }
    if (line.includes('[Seed]')) return { color: '#4a5568' }
    if (line.includes('[NarrowAgent]')) return { color: '#fb923c' }
    return { color: '#64748b' }
  }

  return (
    <div
      style={{
        background: '#0a0c10',
        height: '100%',
        overflowY: 'auto',
        padding: 12,
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: 11,
        lineHeight: 1.5,
      }}
      className="dark-scroll"
    >
      {lines.length === 0 ? (
        <div style={{ color: '#4a5568' }}>
          Connecting to log stream...
          <br />
          <span style={{ color: '#2d3149' }}>
            (Start an action in the legacy UI to see live Gemini API calls)
          </span>
        </div>
      ) : (
        lines.map((line, i) => (
          <div key={i} style={colorLine(line)}>
            {line}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
