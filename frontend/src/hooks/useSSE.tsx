import {
  createContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react'
import { useR4miStore } from '../store/r4mi.store'

const SSEContext = createContext<null>(null)

export function SSEProvider({ children }: { children: ReactNode }) {
  const esRef = useRef<EventSource | null>(null)
  const {
    setOpportunitySessionId,
    addPublishedAgent,
    appendDemoStep,
    setCurrentSpec,
    updatePublishedAgent,
    setQuotaExhausted,
    setMatchedAgent,
  } = useR4miStore()

  useEffect(() => {
    const es = new EventSource('/api/sse')
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data)
        const event = raw.event as string
        const data = raw.data as Record<string, unknown>

        switch (event) {
          case 'OPTIMIZATION_OPPORTUNITY':
            setOpportunitySessionId(data.session_id as string)
            break
          case 'AGENT_MATCH_FOUND':
            if (data.matched_spec) {
              const spec = data.matched_spec as Record<string, unknown>
              setMatchedAgent(spec as any, (spec.match_score as number) ?? null)
            }
            setOpportunitySessionId(data.session_id as string)
            break
          case 'SPEC_GENERATED':
          case 'SPEC_UPDATED':
            setCurrentSpec(data.spec as any)
            break
          case 'AGENT_PUBLISHED':
            addPublishedAgent(data as any)
            break
          case 'AGENT_DEMO_STEP':
            appendDemoStep(data as any)
            break
          case 'AGENT_EXCEPTION':
            if (data.reason === 'quota_exhausted') setQuotaExhausted(true)
            break
          case 'AGENT_RUN_COMPLETE':
            updatePublishedAgent({
              id: data.spec_id as string,
              successful_runs: data.successful_runs as number,
            })
            break
        }
      } catch {
        // ignore malformed SSE messages
      }
    }

    es.onerror = () => {
      // SSE will auto-reconnect
    }

    return () => {
      es.close()
    }
  }, [])

  return <SSEContext.Provider value={null}>{children}</SSEContext.Provider>
}
