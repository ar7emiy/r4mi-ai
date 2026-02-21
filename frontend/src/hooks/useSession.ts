import { create } from 'zustand'

export type PipelineStage =
  | 'idle'
  | 'session_active'
  | 'opportunity_detected'
  | 'capture_active'
  | 'spec_ready'
  | 'spec_approved'
  | 'module_built'
  | 'module_tested'
  | 'shadow_mode'

export interface OpportunityData {
  id: string
  name: string
  confidence: number
  complexity: string
  status: string
  rationale: string
}

export interface SpecStep {
  index: number
  action: string
  target: string
  notes: string
  automatable: boolean
}

export interface SpecData {
  id: string
  trigger: string
  steps: SpecStep[]
  exceptions: string[]
  success_criteria: string
  open_questions: string[]
  status: string
}

export interface TestResult {
  name: string
  result: string
}

export interface ModuleData {
  id: string
  version: number
  code_stub: string
  test_results: TestResult[]
  feedback_history: string[]
  status: string
}

interface SessionStore {
  sessionId: string | null
  captureId: string | null
  ticketType: string
  opportunity: OpportunityData | null
  spec: SpecData | null
  module: ModuleData | null
  stage: PipelineStage
  isLoading: boolean
  error: string | null

  setTicketType: (t: string) => void
  startSession: () => Promise<void>
  detectOpportunity: () => Promise<void>
  startCapture: () => Promise<void>
  closeCapture: () => Promise<void>
  approveSpec: () => Promise<void>
  buildModule: () => Promise<void>
  testModule: () => Promise<void>
  tuneModule: (feedback: string) => Promise<void>
  promoteModule: () => Promise<void>
  reset: () => void
}

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail || 'API error')
  }
  return res.json() as Promise<T>
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionId: null,
  captureId: null,
  ticketType: 'billing_dispute',
  opportunity: null,
  spec: null,
  module: null,
  stage: 'idle',
  isLoading: false,
  error: null,

  setTicketType: (t) => set({ ticketType: t }),

  startSession: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ session: { id: string } }>(
        '/api/sessions', 'POST', { ticket_type: get().ticketType }
      )
      set({ sessionId: data.session.id, stage: 'session_active', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  detectOpportunity: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ opportunity: OpportunityData }>(
        `/api/sessions/${sessionId}/detect`, 'POST'
      )
      set({ opportunity: data.opportunity, stage: 'opportunity_detected', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  startCapture: async () => {
    const { opportunity } = get()
    if (!opportunity) return
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ capture: { id: string } }>(
        '/api/captures/start', 'POST', { opportunity_id: opportunity.id }
      )
      set({ captureId: data.capture.id, stage: 'capture_active', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  closeCapture: async () => {
    const { captureId } = get()
    if (!captureId) return
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ spec: SpecData }>(
        '/api/captures/close', 'POST', { capture_id: captureId }
      )
      set({ spec: data.spec, stage: 'spec_ready', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  approveSpec: async () => {
    const { spec } = get()
    if (!spec) return
    set({ isLoading: true, error: null })
    try {
      await api('/api/specs/approve', 'POST', { spec_id: spec.id })
      set({ stage: 'spec_approved', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  buildModule: async () => {
    const { spec } = get()
    if (!spec) return
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ module: ModuleData }>(
        '/api/modules/build', 'POST', { spec_id: spec.id }
      )
      set({ module: data.module, stage: 'module_built', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  testModule: async () => {
    const { module } = get()
    if (!module) return
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ module: ModuleData }>(
        '/api/modules/test', 'POST', { module_id: module.id }
      )
      set({ module: data.module, stage: 'module_tested', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  tuneModule: async (feedback: string) => {
    const { module } = get()
    if (!module) return
    set({ isLoading: true, error: null })
    try {
      const data = await api<{ module: ModuleData }>(
        '/api/modules/tune', 'POST', { module_id: module.id, feedback }
      )
      set({ module: data.module, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  promoteModule: async () => {
    const { module } = get()
    if (!module) return
    set({ isLoading: true, error: null })
    try {
      await api('/api/modules/promote', 'POST', { module_id: module.id })
      set({ stage: 'shadow_mode', isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  reset: () =>
    set({
      sessionId: null,
      captureId: null,
      opportunity: null,
      spec: null,
      module: null,
      stage: 'idle',
      isLoading: false,
      error: null,
    }),
}))
