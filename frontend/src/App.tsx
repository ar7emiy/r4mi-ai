import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LegacyPermitApp } from './components/legacy/LegacyPermitApp'
import { EvidencePage } from './pages/EvidencePage'
import { SystemPage } from './pages/SystemPage'
import { TabProgressionBar } from './components/overlay/TabProgressionBar'
import { OptimizationPanel } from './components/overlay/OptimizationPanel'
import { SSEProvider } from './hooks/useSSE'

export default function App() {
  return (
    <BrowserRouter>
      <SSEProvider>
        <div style={{ paddingBottom: 48 }}>
          <Routes>
            <Route path="/" element={<LegacyPermitApp />} />
            <Route path="/evidence/:sessionId" element={<EvidencePage />} />
            <Route path="/evidence" element={<EvidencePage />} />
            <Route path="/system" element={<SystemPage />} />
          </Routes>
        </div>
        <TabProgressionBar />
        <OptimizationPanel />
      </SSEProvider>
    </BrowserRouter>
  )
}
