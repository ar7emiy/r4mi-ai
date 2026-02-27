import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentSpec } from '@/store/r4mi.store'

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export function useAgentMarket(filters?: { trust_level?: string; permit_type?: string }) {
  const params = new URLSearchParams()
  if (filters?.trust_level) params.set('trust_level', filters.trust_level)
  if (filters?.permit_type) params.set('permit_type', filters.permit_type)
  const qs = params.toString()

  return useQuery<AgentSpec[]>({
    queryKey: ['agents', filters],
    queryFn: () => fetchJson(`/agents${qs ? `?${qs}` : ''}`),
    staleTime: 10_000,
  })
}

export function useAgentById(agentId: string | null) {
  return useQuery<AgentSpec>({
    queryKey: ['agents', agentId],
    queryFn: () => fetchJson(`/agents/${agentId}`),
    enabled: !!agentId,
  })
}

interface PublishAgentPayload {
  name: string
  description: string
  trigger_pattern: Record<string, unknown>
  action_sequence: unknown[]
  knowledge_sources: unknown[]
  permit_type?: string
  user_id?: string
}

export function usePublishAgent() {
  const qc = useQueryClient()
  return useMutation<AgentSpec, Error, PublishAgentPayload>({
    mutationFn: (payload) =>
      fetchJson('/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

interface ForkAgentPayload {
  agentId: string
  tuning_delta: Record<string, unknown>
  user_id?: string
}

export function useForkAgent() {
  const qc = useQueryClient()
  return useMutation<AgentSpec, Error, ForkAgentPayload>({
    mutationFn: ({ agentId, ...rest }) =>
      fetchJson(`/agents/${agentId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useDemoAgent() {
  return useMutation<{ status: string }, Error, { agentId: string; sessionId: string }>({
    mutationFn: ({ agentId, sessionId }) =>
      fetchJson(`/agents/${agentId}/demo?session_id=${sessionId}`, { method: 'POST' }),
  })
}
