import { useEffect, useRef, useState } from 'react'

export function useLogs(maxLines = 200) {
  const [lines, setLines] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/logs')
    esRef.current = es

    es.onmessage = (e) => {
      if (e.data === ': keepalive') return
      setLines((prev) => {
        const next = [...prev, e.data]
        return next.length > maxLines ? next.slice(-maxLines) : next
      })
    }

    return () => es.close()
  }, [maxLines])

  return lines
}
