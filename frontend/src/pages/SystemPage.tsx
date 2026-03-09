import { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

const DIAGRAM = `
flowchart TD
    subgraph Browser["Browser — Mock Legacy Permit UI"]
        UI["Legacy Permit UI\\n(2008-style)"]
        TabBar["Tab Progression Bar"]
        OptPanel["Optimization Panel"]
    end

    subgraph Backend["Backend — FastAPI"]
        Observe["/api/observe"]
        SessionAPI["/api/session"]
        AgentsAPI["/api/agents"]
        SSE["/api/sse"]
        Logs["/api/logs"]
        Stubs["/api/stubs/*"]
    end

    subgraph AI["AI Layer — google-genai"]
        Observer["ObserverAgent\\n(state machine)"]
        Embedding["EmbeddingService\\ngemini-embedding-001 REAL"]
        Vision["VisionService\\ngemini-2.5-flash-lite REAL"]
        SpecBuilder["SpecBuilderAgent\\ngemini-2.5-flash-lite REAL"]
        Matcher["MarketMatcher\\ncosine similarity REAL"]
        Narrow["NarrowAgent\\nexecutes spec"]
    end

    subgraph DB["SQLite"]
        Sessions[("sessions")]
        Specs[("narrow_agent_specs")]
    end

    UI -->|UIEvent POST| Observe
    Observe --> Observer
    Observer --> Embedding
    Observer --> Vision
    Observer --> Sessions
    Embedding -->|cosine sim| Matcher
    Matcher --> Specs
    AgentsAPI --> SpecBuilder
    SpecBuilder --> Embedding
    SpecBuilder --> Specs
    SSE -->|OPTIMIZATION_OPPORTUNITY| TabBar
    TabBar --> OptPanel
    OptPanel -->|confirm| AgentsAPI
    AgentsAPI --> Narrow
    Narrow -->|AGENT_DEMO_STEP| SSE
    Stubs -->|seed JSON| UI
`

export function SystemPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'dark' })
    if (containerRef.current) {
      mermaid.render('system-diagram', DIAGRAM).then(({ svg }) => {
        if (containerRef.current) containerRef.current.innerHTML = svg
      })
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1117',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 40,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 8 }}
      >
        r4mi-ai System Architecture
      </div>
      <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 32 }}>
        UML Activity Diagram — 3 swimlanes: Browser / Backend / AI Layer
      </div>

      <div
        ref={containerRef}
        style={{
          background: '#1a1d27',
          border: '1px solid #2d3149',
          borderRadius: 8,
          padding: 24,
          maxWidth: 960,
          width: '100%',
        }}
      />
    </div>
  )
}
