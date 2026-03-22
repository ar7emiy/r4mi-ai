import { useEffect, useRef } from 'react'
import { type MessageType } from './useChatMessages'

const API_BASE =
  new URLSearchParams(window.location.search).get('api') ||
  'http://localhost:8000'

/** Maps SSE event types to chat message configs */
function mapSSE(
  event: string,
  payload: Record<string, unknown>,
): { type: MessageType; text: string; data?: Record<string, unknown> } | null {
  switch (event) {
    case 'OPTIMIZATION_OPPORTUNITY':
      return {
        type: 'notification',
        text: `Pattern detected — I've seen this workflow ${payload.match_count ?? 3} times.`,
        data: payload,
      }
    case 'AGENT_MATCH_FOUND':
      return {
        type: 'match',
        text: `Existing agent match — ${payload.name ?? 'unknown'}`,
        data: payload,
      }
    case 'SPEC_GENERATED':
    case 'SPEC_UPDATED':
      // Suppress if this was triggered by our own build action (sidebar already shows it)
      return null
    case 'AGENT_DEMO_STEP':
      return {
        type: 'agent-step',
        text: `${payload.field}: ${payload.value} (${payload.source_tag})`,
        data: payload,
      }
    case 'AGENT_PUBLISHED':
      // Suppress — sidebar already shows publish confirmation from the action handler
      return null
    case 'AGENT_RUN_COMPLETE':
      return {
        type: 'system',
        text: `Run complete. ${payload.fields_processed ?? 0} fields processed.`,
        data: payload,
      }
    case 'AGENT_EXCEPTION':
      return {
        type: 'error',
        text: `Error: ${payload.reason ?? 'unknown'}`,
        data: payload,
      }
    default:
      return null
  }
}

export function useSidebarSSE(
  addMessage: (type: MessageType, text: string, data?: Record<string, unknown>) => void,
) {
  const addMessageRef = useRef(addMessage)
  addMessageRef.current = addMessage

  useEffect(() => {
    let es: EventSource | null = null

    function connect() {
      es = new EventSource(`${API_BASE}/api/sse`)

      es.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data)
          const event = raw.event as string
          const payload = (raw.data ?? raw) as Record<string, unknown>

          const mapped = mapSSE(event, payload)
          if (mapped) {
            // Inject the event type into data so ChatMessage can render action buttons
            const enriched = { ...mapped.data, event }
            addMessageRef.current(mapped.type, mapped.text, enriched)
          }
        } catch {
          // ignore malformed messages
        }
      }

      es.onerror = () => {
        es?.close()
        // Reconnect after 3s
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      es?.close()
    }
  }, [])
}
