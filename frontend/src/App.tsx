import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LegacyPermitApp } from './components/legacy/LegacyPermitApp'
import { EvidencePage } from './pages/EvidencePage'
import { SystemPage } from './pages/SystemPage'
import { KanbanPage } from './pages/KanbanPage'
import { SidebarApp } from './sidebar/SidebarApp'
import { SSEProvider } from './hooks/useSSE'

export default function App() {
  return (
    <BrowserRouter>
      <SSEProvider>
        <Routes>
          {/* Sidebar — rendered inside the r4mi-loader iframe */}
          <Route path="/sidebar" element={<SidebarApp />} />

          {/* Main app routes */}
          <Route path="/" element={<LegacyPermitApp />} />
          <Route path="/evidence/:sessionId" element={<EvidencePage />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
        </Routes>
      </SSEProvider>
    </BrowserRouter>
  )
}
