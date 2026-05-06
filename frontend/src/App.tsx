import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { EvidencePage } from './pages/EvidencePage'
import { SystemPage } from './pages/SystemPage'
import { SidebarApp } from './sidebar/SidebarApp'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Sidebar — rendered inside the r4mi-loader iframe */}
        <Route path="/sidebar" element={<SidebarApp />} />

        {/* r4mi utility routes */}
        <Route path="/evidence/:sessionId" element={<EvidencePage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/system" element={<SystemPage />} />
      </Routes>
    </BrowserRouter>
  )
}
