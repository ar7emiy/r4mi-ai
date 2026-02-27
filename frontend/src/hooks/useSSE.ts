import { useCallback, useEffect, useRef } from 'react'
import { useR4miStore, type SSEMessage } from '@/store/r4mi.store'

const RECONNECT_DELAY_MS = 3000

/**
 * Connects to the backend SSE stream at /sse/{sessionId}.
 * Parses incoming events and dispatches them to the Zustand store.
 * Auto-reconnects on disconnect.
 */
export function useSSE(sessionId: string | null) {
  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { handleSSEEvent, setSseConnected } = useR4miStore()

  const connect = useCallback(() => {
    if (!sessionId) return

    // Close previous connection if any
    esRef.current?.close()
    if (reconnectRef.current) clearTimeout(reconnectRef.current)

    const es = new EventSource(`/sse/${sessionId}`)
    esRef.current = es

    es.onopen = () => {
      setSseConnected(true)
    }

    es.onmessage = (event) => {
      try {
        const msg: SSEMessage = JSON.parse(event.data)
        if (msg.type === 'PING') return  // ignore keepalives
        handleSSEEvent(msg)
      } catch {
        // Ignore malformed events
      }
    }

    es.onerror = () => {
      setSseConnected(false)
      es.close()
      // Reconnect after delay
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }
  }, [sessionId, handleSSEEvent, setSseConnected])

  useEffect(() => {
    connect()
    return () => {
      esRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      setSseConnected(false)
    }
  }, [connect])
}
