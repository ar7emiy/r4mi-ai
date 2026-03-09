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
    setPanelView,
    addPublishedAgent,
    appendDemoStep,
    setCurrentSpec,
    updatePublishedAgent,
  } = useR4miStore()

  useEffect(() => {
    const es = new EventSource('/api/sse')
    esRef.current = es

    es.addEventListener('OPTIMIZATION_OPPORTUNITY', (e) => {
      const data = JSON.parse(e.data)
      setOpportunitySessionId(data.session_id)
    })

    es.addEventListener('SPEC_GENERATED', (e) => {
      const data = JSON.parse(e.data)
      setCurrentSpec(data.spec)
      setPanelView('spec')
    })

    es.addEventListener('SPEC_UPDATED', (e) => {
      const data = JSON.parse(e.data)
      setCurrentSpec(data.spec)
    })

    es.addEventListener('AGENT_PUBLISHED', (e) => {
      const data = JSON.parse(e.data)
      addPublishedAgent(data)
    })

    es.addEventListener('AGENT_DEMO_STEP', (e) => {
      const data = JSON.parse(e.data)
      appendDemoStep(data)
    })

    es.addEventListener('AGENT_RUN_COMPLETE', (e) => {
      const data = JSON.parse(e.data)
      updatePublishedAgent({
        id: data.spec_id,
        successful_runs: data.successful_runs,
      })
    })

    es.onerror = () => {
      // SSE will auto-reconnect
    }

    return () => {
      es.close()
    }
  }, [])

  return <SSEContext.Provider value={null}>{children}</SSEContext.Provider>
}
