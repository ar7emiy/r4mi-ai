import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'

// Pages (keep existing pages during migration)
import Factory from './pages/Factory'
import CRM from './pages/CRM'

// New r4mi-ai components
import { TabProgressionBar } from './components/TabProgressionBar'
import { SourceHighlight } from './components/SourceHighlight'
import { AgentDemo } from './components/AgentDemo'
import { AgentMarket } from './components/AgentMarket'
import { SystemDiagram } from './components/SystemDiagram'
import { useSSE } from './hooks/useSSE'
import { useR4miStore } from './store/r4mi.store'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
})

/**
 * AppShell: wraps all pages with the r4mi-ai SSE connection,
 * global overlays (SourceHighlight, AgentDemo), and TabProgressionBar.
 */
function AppShell({ children }: { children: React.ReactNode }) {
  const { sessionId } = useR4miStore()

  // Connect to SSE stream whenever we have a session
  useSSE(sessionId)

  return (
    <>
      {children}
      <SourceHighlight />
      <AgentDemo />
      <TabProgressionBar />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Factory />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/market" element={<AgentMarket />} />
            <Route path="/system" element={<SystemDiagram />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
