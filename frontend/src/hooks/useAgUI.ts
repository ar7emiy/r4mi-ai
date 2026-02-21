import { useState, useCallback, useRef } from 'react'

export interface AgUIAction {
  type: 'fill_field' | 'highlight' | 'click' | 'submit' | 'done'
  target?: string
  value?: string
  source_region?: string
  reason?: string
  delay_ms?: number
}

interface UseAgUIOptions {
  sessionId: string | null
  onAction?: (action: AgUIAction) => void
  onDone?: () => void
}

export function useAgUI({ sessionId, onAction, onDone }: UseAgUIOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [actions, setActions] = useState<AgUIAction[]>([])
  const [error, setError] = useState<string | null>(null)
  const evtSourceRef = useRef<EventSource | null>(null)

  const startStream = useCallback(() => {
    if (!sessionId) return
    if (evtSourceRef.current) {
      evtSourceRef.current.close()
    }

    setIsStreaming(true)
    setActions([])
    setError(null)

    const evtSource = new EventSource(`/api/agui/stream?session_id=${sessionId}`)
    evtSourceRef.current = evtSource

    evtSource.onmessage = (e) => {
      try {
        const action = JSON.parse(e.data) as AgUIAction
        if (action.type === 'done') {
          setIsStreaming(false)
          evtSource.close()
          onDone?.()
          return
        }
        setActions((prev) => [...prev, action])
        onAction?.(action)
      } catch {
        console.error('Failed to parse AG-UI action', e.data)
      }
    }

    evtSource.onerror = () => {
      setIsStreaming(false)
      setError('Stream connection lost')
      evtSource.close()
    }
  }, [sessionId, onAction, onDone])

  const stopStream = useCallback(() => {
    evtSourceRef.current?.close()
    setIsStreaming(false)
  }, [])

  return { isStreaming, actions, error, startStream, stopStream }
}
