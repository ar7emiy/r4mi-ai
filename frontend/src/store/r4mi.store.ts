import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'CONNECTED' | 'PING'
  | 'OPTIMIZATION_OPPORTUNITY' | 'PATTERN_UPDATE'
  | 'REPLAY_FRAME' | 'SOURCE_HIGHLIGHT' | 'SPEC_READY'
  | 'AGENTVERSE_MATCH' | 'AGENTVERSE_NO_MATCH'
  | 'AGENT_DEMO_STEP' | 'AGENT_STATUS_UPDATE' | 'AGENT_COMPLETED'
  | 'TRUST_LEVEL_CHANGED' | 'EXCEPTION_FLAGGED'

export interface SSEMessage {
  type: SSEEventType
  data?: Record<string, unknown>
}

export type TrustLevel = 'supervised' | 'autonomous' | 'stale'
export type AgentStatus = 'idle' | 'running' | 'flagging' | 'completed' | 'error'

export interface ActiveAgent {
  id: string
  name: string
  trust_level: TrustLevel
  status: AgentStatus
  last_result?: string
  current_step?: number
  total_steps?: number
}

export interface HighlightRegion {
  screen_name: string
  element_selector: string
  confidence: number
  text_preview?: string
  region_type?: string
}

export interface ReplayFrameData {
  frame_index: number
  event: Record<string, unknown>
  highlighted_element?: string
  knowledge_source?: Record<string, unknown>
  timestamp_ms: number
  screen_name: string
  action_label: string
}

export interface OptimizationOpportunity {
  session_id: string
  permit_type: string
  confidence: number
  sessions_count: number
  screens: string[]
  message: string
}

export interface AgentSpec {
  id: string
  name: string
  description: string
  trigger_pattern: Record<string, unknown>
  action_sequence: unknown[]
  knowledge_sources: unknown[]
  contributions: Array<{ user_id: string; score: number }>
  trust_level: TrustLevel
  successful_runs: number
  failed_runs: number
  permit_type?: string
  created_at: string
  updated_at: string
}

export interface DemoStep {
  step_index: number
  total_steps: number
  field_id: string
  value: string
  screen_name: string
  rationale?: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface R4miStore {
  // Connection
  sessionId: string | null
  sseConnected: boolean

  // Pattern detection
  optimizationOpportunity: OptimizationOpportunity | null
  patternConfidence: number

  // Replay / confirmation flow
  replayFrames: ReplayFrameData[]
  currentReplayFrameIdx: number
  highlightRegions: HighlightRegion[]
  specReady: AgentSpec | null

  // Agentverse
  agentverseMatch: AgentSpec | null
  activeAgents: ActiveAgent[]

  // Agent demo
  demoSteps: DemoStep[]
  currentDemoStep: number
  demoFieldValues: Record<string, string>  // field_id → value for ActionForm

  // UI state
  showOptimizationTab: boolean
  showReplay: boolean
  showSourceHighlight: boolean
  showAgentDemo: boolean

  // ── Actions ──
  setSessionId: (id: string) => void
  setSseConnected: (connected: boolean) => void
  setCurrentReplayFrameIdx: (idx: number) => void
  setCurrentDemoStep: (idx: number) => void
  setShowOptimizationTab: (show: boolean) => void
  setShowReplay: (show: boolean) => void
  setShowSourceHighlight: (show: boolean) => void
  setShowAgentDemo: (show: boolean) => void
  clearDemoFieldValues: () => void

  handleSSEEvent: (msg: SSEMessage) => void
}

export const useR4miStore = create<R4miStore>((set, get) => ({
  // Connection
  sessionId: null,
  sseConnected: false,

  // Pattern
  optimizationOpportunity: null,
  patternConfidence: 0,

  // Replay
  replayFrames: [],
  currentReplayFrameIdx: 0,
  highlightRegions: [],
  specReady: null,

  // Agentverse
  agentverseMatch: null,
  activeAgents: [],

  // Demo
  demoSteps: [],
  currentDemoStep: 0,
  demoFieldValues: {},

  // UI
  showOptimizationTab: false,
  showReplay: false,
  showSourceHighlight: false,
  showAgentDemo: false,

  // ── Simple setters ──
  setSessionId: (id) => set({ sessionId: id }),
  setSseConnected: (connected) => set({ sseConnected: connected }),
  setCurrentReplayFrameIdx: (idx) => set({ currentReplayFrameIdx: idx }),
  setCurrentDemoStep: (idx) => set({ currentDemoStep: idx }),
  setShowOptimizationTab: (show) => set({ showOptimizationTab: show }),
  setShowReplay: (show) => set({ showReplay: show }),
  setShowSourceHighlight: (show) => set({ showSourceHighlight: show }),
  setShowAgentDemo: (show) => set({ showAgentDemo: show }),
  clearDemoFieldValues: () => set({ demoFieldValues: {} }),

  // ── SSE event dispatcher ──
  handleSSEEvent: (msg) => {
    const data = msg.data ?? {}

    switch (msg.type) {
      case 'CONNECTED':
        set({ sseConnected: true })
        break

      case 'OPTIMIZATION_OPPORTUNITY':
        set({
          optimizationOpportunity: data as unknown as OptimizationOpportunity,
          patternConfidence: (data.confidence as number) ?? 0,
        })
        break

      case 'PATTERN_UPDATE':
        set({ patternConfidence: (data.confidence as number) ?? get().patternConfidence })
        break

      case 'SOURCE_HIGHLIGHT':
        set({
          highlightRegions: (data.regions as HighlightRegion[]) ?? [],
          showSourceHighlight: true,
        })
        break

      case 'REPLAY_FRAME':
        set((s) => ({ replayFrames: [...s.replayFrames, data as unknown as ReplayFrameData] }))
        break

      case 'SPEC_READY':
        set({ specReady: data.spec as AgentSpec ?? null })
        break

      case 'AGENTVERSE_MATCH':
        set({ agentverseMatch: data.agent as AgentSpec ?? null })
        break

      case 'AGENTVERSE_NO_MATCH':
        set({ agentverseMatch: null })
        break

      case 'AGENT_STATUS_UPDATE': {
        const { agent_id: id, agent_name: name, status } = data as Record<string, string>
        set((s) => {
          const exists = s.activeAgents.find((a) => a.id === id)
          if (exists) {
            return {
              activeAgents: s.activeAgents.map((a) =>
                a.id === id ? { ...a, status: status as AgentStatus } : a
              ),
            }
          }
          return {
            activeAgents: [
              ...s.activeAgents,
              {
                id,
                name,
                trust_level: 'supervised' as TrustLevel,
                status: (status as AgentStatus) ?? 'running',
              },
            ],
            showAgentDemo: true,
            demoSteps: [],
            currentDemoStep: 0,
          }
        })
        break
      }

      case 'AGENT_DEMO_STEP': {
        const step = data as unknown as DemoStep
        set((s) => ({
          demoSteps: [...s.demoSteps, step],
          currentDemoStep: step.step_index,
          demoFieldValues: step.field_id
            ? { ...s.demoFieldValues, [step.field_id]: step.value }
            : s.demoFieldValues,
        }))
        break
      }

      case 'AGENT_COMPLETED': {
        const { agent_id: id, success } = data as Record<string, unknown>
        set((s) => ({
          activeAgents: s.activeAgents.map((a) =>
            a.id === id
              ? { ...a, status: success ? ('completed' as AgentStatus) : ('error' as AgentStatus) }
              : a
          ),
        }))
        break
      }

      case 'TRUST_LEVEL_CHANGED': {
        const { agent_id: id, new_level } = data as Record<string, string>
        set((s) => ({
          activeAgents: s.activeAgents.map((a) =>
            a.id === id ? { ...a, trust_level: new_level as TrustLevel } : a
          ),
        }))
        break
      }

      case 'EXCEPTION_FLAGGED': {
        const { agent_id: id } = data as Record<string, string>
        set((s) => ({
          activeAgents: s.activeAgents.map((a) =>
            a.id === id ? { ...a, status: 'flagging' as AgentStatus } : a
          ),
        }))
        break
      }

      default:
        break
    }
  },
}))
