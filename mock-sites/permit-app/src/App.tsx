import { PermitProvider } from './context/PermitContext'
import { LegacyPermitApp } from './components/LegacyPermitApp'

export default function App() {
  return (
    <PermitProvider>
      <LegacyPermitApp />
    </PermitProvider>
  )
}
