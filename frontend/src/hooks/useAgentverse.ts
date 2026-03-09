import { useQuery } from '@tanstack/react-query'
import { AgentSpec } from '../store/r4mi.store'

async function fetchAgents(): Promise<AgentSpec[]> {
  const res = await fetch('/api/agents')
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

export function useAgentverse() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 10_000,
  })
}
