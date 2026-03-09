import { create } from 'zustand'

export type TrustLevel = 'supervised' | 'autonomous' | 'stale'

export interface AgentSpec {
  id: string
  name: string
  description: string
  permit_type: string
  action_sequence: Array<{
    step: number
    action: string
    source: string
    field: string
    description: string
  }>
  knowledge_sources: Array<{
    type: string
    name: string
    reference: string
    confidence: number
  }>
  trust_level: TrustLevel
  successful_runs: number
  failed_runs: number
  contributions: Array<{ user_id: string; role: string; share_pct: number }>
  parent_spec_id?: string
  created_at: string
}

export interface DemoStep {
  step: number
  action: string
  field: string
  value: string
  source_tag: string
  confidence: number
  status: string
}

export type PanelView =
  | 'closed'
  | 'optimization'
  | 'replay'
  | 'spec'
  | 'agentverse'
  | 'cli'

interface R4miState {
  // SSE / detection
  opportunitySessionId: string | null
  setOpportunitySessionId: (id: string | null) => void

  // Panel
  panelView: PanelView
  setPanelView: (v: PanelView) => void

  // Demo mode (correction flow)
  demoMode: boolean
  setDemoMode: (v: boolean) => void

  // Replay
  replayFrames: unknown[]
  setReplayFrames: (frames: unknown[]) => void

  // Current spec under review
  currentSpec: AgentSpec | null
  setCurrentSpec: (spec: AgentSpec | null) => void

  // Agent run steps
  demoSteps: DemoStep[]
  appendDemoStep: (step: DemoStep) => void
  clearDemoSteps: () => void

  // Agentverse
  publishedAgents: AgentSpec[]
  addPublishedAgent: (spec: AgentSpec) => void
  updatePublishedAgent: (spec: Partial<AgentSpec> & { id: string }) => void

  // Active application in legacy UI
  activeApplicationId: string | null
  setActiveApplicationId: (id: string | null) => void
}

export const useR4miStore = create<R4miState>((set) => ({
  opportunitySessionId: null,
  setOpportunitySessionId: (id) => set({ opportunitySessionId: id }),

  panelView: 'closed',
  setPanelView: (v) => set({ panelView: v }),

  demoMode: false,
  setDemoMode: (v) => set({ demoMode: v }),

  replayFrames: [],
  setReplayFrames: (frames) => set({ replayFrames: frames }),

  currentSpec: null,
  setCurrentSpec: (spec) => set({ currentSpec: spec }),

  demoSteps: [],
  appendDemoStep: (step) =>
    set((s) => ({ demoSteps: [...s.demoSteps, step] })),
  clearDemoSteps: () => set({ demoSteps: [] }),

  publishedAgents: [],
  addPublishedAgent: (spec) =>
    set((s) => ({ publishedAgents: [...s.publishedAgents, spec] })),
  updatePublishedAgent: (patch) =>
    set((s) => ({
      publishedAgents: s.publishedAgents.map((a) =>
        a.id === patch.id ? { ...a, ...patch } : a,
      ),
    })),

  activeApplicationId: null,
  setActiveApplicationId: (id) => set({ activeApplicationId: id }),
}))
