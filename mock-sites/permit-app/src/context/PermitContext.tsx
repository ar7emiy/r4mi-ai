import { createContext, useContext, useState, type ReactNode } from 'react'

interface PermitCtx {
  activeApplicationId: string | null
  setActiveApplicationId: (id: string | null) => void
  demoMode: boolean
  setDemoMode: (v: boolean) => void
}

const PermitContext = createContext<PermitCtx>({
  activeApplicationId: null,
  setActiveApplicationId: () => {},
  demoMode: false,
  setDemoMode: () => {},
})

export function PermitProvider({ children }: { children: ReactNode }) {
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  return (
    <PermitContext.Provider value={{ activeApplicationId, setActiveApplicationId, demoMode, setDemoMode }}>
      {children}
    </PermitContext.Provider>
  )
}

export const usePermit = () => useContext(PermitContext)
