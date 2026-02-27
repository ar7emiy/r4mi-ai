import { Link } from 'react-router-dom'
import { useR4miStore } from '@/store/r4mi.store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Zap, Activity, Store, GitBranch, Radio } from 'lucide-react'

const TRUST_COLORS: Record<string, string> = {
  supervised: 'text-amber-400',
  autonomous: 'text-emerald-400',
  stale: 'text-gray-500',
}

const TRUST_LABELS: Record<string, string> = {
  supervised: 'S',
  autonomous: 'A',
  stale: '~',
}

export default function Factory() {
  const { sessionId, sseConnected, optimizationOpportunity, activeAgents } = useR4miStore()

  const runningAgents = activeAgents.filter((a) => a.status === 'running')
  const completedAgents = activeAgents.filter((a) => a.status === 'completed')

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-gray-800 bg-gray-900 px-6 py-3">
        <Zap className="h-5 w-5 text-indigo-400" />
        <span className="font-semibold text-sm">r4mi-ai</span>
        <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
          UI Workflow Automation Factory
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs',
              sseConnected ? 'text-emerald-400' : 'text-gray-500'
            )}
          >
            <Radio className="h-3 w-3" />
            {sseConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <aside className="flex w-52 shrink-0 flex-col border-r border-gray-800 bg-gray-900 p-4 gap-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Navigation</p>

          <Link
            to="/crm"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Activity className="h-4 w-4 text-blue-400" />
            Permit Desk
          </Link>

          <Link
            to="/market"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Store className="h-4 w-4 text-indigo-400" />
            Agent Market
          </Link>

          <Link
            to="/system"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <GitBranch className="h-4 w-4 text-purple-400" />
            Architecture
          </Link>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="mx-auto max-w-2xl">
            {/* Hero */}
            <div className="mb-10 text-center">
              <div className="mb-4 flex justify-center">
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-5">
                  <Zap className="h-10 w-10 text-indigo-400" />
                </div>
              </div>
              <h1 className="mb-2 text-3xl font-bold text-white">r4mi-ai</h1>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
                Passive UI observation · Pattern detection · Narrow agent factory · Agentverse market
              </p>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">Session</p>
                <p className={cn('text-sm font-mono truncate', sessionId ? 'text-white' : 'text-gray-600')}>
                  {sessionId ? sessionId.slice(0, 16) + '…' : 'none'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">Active Agents</p>
                <p className="text-sm font-semibold text-white">{runningAgents.length}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs text-gray-500 mb-1">Completed Runs</p>
                <p className="text-sm font-semibold text-white">{completedAgents.length}</p>
              </div>
            </div>

            {/* Optimization opportunity banner */}
            {optimizationOpportunity && (
              <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-300">Optimization Opportunity Detected</p>
                  <p className="text-xs text-amber-400/70 mt-0.5 truncate">
                    Confidence: {Math.round((optimizationOpportunity.pattern_confidence ?? 0) * 100)}% ·{' '}
                    {optimizationOpportunity.affected_sessions?.length ?? 0} sessions
                  </p>
                </div>
              </div>
            )}

            {/* Active agents list */}
            {activeAgents.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Active Agents</p>
                <div className="space-y-2">
                  {activeAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3 text-sm">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full flex-shrink-0',
                          agent.status === 'running'
                            ? 'bg-indigo-400 animate-pulse'
                            : agent.status === 'completed'
                              ? 'bg-emerald-400'
                              : agent.status === 'error'
                                ? 'bg-red-400'
                                : 'bg-gray-600'
                        )}
                      />
                      <span className="flex-1 text-gray-300 truncate">{agent.name}</span>
                      <span
                        className={cn(
                          'text-xs font-mono font-bold',
                          TRUST_COLORS[agent.trust_level] ?? 'text-gray-500'
                        )}
                      >
                        {TRUST_LABELS[agent.trust_level] ?? '?'}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">{agent.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick-start hint */}
            {!sessionId && (
              <div className="mt-6 rounded-xl border border-dashed border-gray-700 p-6 text-center">
                <p className="text-gray-500 text-sm">
                  Open the{' '}
                  <Link to="/crm" className="text-indigo-400 hover:text-indigo-300 underline">
                    Permit Desk
                  </Link>{' '}
                  to begin observation, or browse the{' '}
                  <Link to="/market" className="text-indigo-400 hover:text-indigo-300 underline">
                    Agent Market
                  </Link>{' '}
                  to see published workflows.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
