import { useState } from 'react'
import { useAgentMarket, useDemoAgent } from '@/hooks/useAgentMarket'
import { useR4miStore, type AgentSpec } from '@/store/r4mi.store'
import { cn } from '@/lib/utils'

const TRUST_STYLES: Record<string, { badge: string; label: string }> = {
  supervised: { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',  label: 'Supervised' },
  autonomous: { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: 'Autonomous' },
  stale:      { badge: 'bg-red-500/20 text-red-300 border-red-500/40',     label: 'Stale' },
}

function ContributionBar({ contributions }: { contributions: Array<{ user_id: string; score: number }> }) {
  const sorted = [...contributions].sort((a, b) => b.score - a.score)
  return (
    <div className="space-y-1">
      {sorted.map((c) => (
        <div key={c.user_id} className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 w-24 truncate">{c.user_id}</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round(c.score * 100)}%` }} />
          </div>
          <span className="text-gray-400 w-8 text-right">{Math.round(c.score * 100)}%</span>
        </div>
      ))}
    </div>
  )
}

function AgentCard({ spec, sessionId }: { spec: AgentSpec; sessionId: string | null }) {
  const trustStyle = TRUST_STYLES[spec.trust_level] ?? TRUST_STYLES.supervised
  const total = spec.successful_runs + spec.failed_runs
  const successRate = total > 0 ? spec.successful_runs / total : 0
  const demoMut = useDemoAgent()

  const handleDemo = () => {
    if (!sessionId) return alert('Start a session first')
    demoMut.mutate({ agentId: spec.id, sessionId })
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3 hover:border-gray-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{spec.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{spec.description}</p>
        </div>
        <span
          className={cn('px-2 py-0.5 text-[11px] rounded-full border flex-shrink-0 font-medium', trustStyle.badge)}
        >
          {trustStyle.label}
        </span>
      </div>

      {/* Permit type + screens */}
      {spec.permit_type && (
        <span className="inline-block px-2 py-0.5 text-[11px] rounded-full bg-gray-700 text-gray-300 border border-gray-600">
          {spec.permit_type.replace(/_/g, ' ')}
        </span>
      )}

      {/* Run stats */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Success rate</span>
          <span>{total > 0 ? `${Math.round(successRate * 100)}%` : 'No runs yet'}</span>
        </div>
        {total > 0 && (
          <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.round(successRate * 100)}%` }}
            />
          </div>
        )}
        {total > 0 && (
          <p className="text-[11px] text-gray-600">
            {spec.successful_runs} successful · {spec.failed_runs} failed
          </p>
        )}
      </div>

      {/* Contributions */}
      {spec.contributions.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 mb-1.5">Contributions</p>
          <ContributionBar contributions={spec.contributions} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleDemo}
          disabled={demoMut.isPending}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-indigo-600 hover:bg-indigo-500 text-white transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {demoMut.isPending ? 'Starting…' : '▶ Demo'}
        </button>
        <button
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-600
                     text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Fork & Tune
        </button>
      </div>
    </div>
  )
}

export function AgentMarket() {
  const { sessionId } = useR4miStore()
  const [trustFilter, setTrustFilter] = useState<string>('')
  const { data: agents, isLoading, error } = useAgentMarket({ trust_level: trustFilter || undefined })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agentverse</h1>
          <p className="text-sm text-gray-400 mt-0.5">Browse and demo published automation agents</p>
        </div>
        <div className="flex gap-2">
          {['', 'supervised', 'autonomous', 'stale'].map((level) => (
            <button
              key={level}
              onClick={() => setTrustFilter(level)}
              className={cn(
                'px-3 py-1 text-xs rounded-full border transition-colors',
                trustFilter === level
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              )}
            >
              {level || 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-gray-500 text-sm">Loading agents…</div>
      )}
      {error && (
        <div className="text-center py-12 text-red-400 text-sm">Error loading agents</div>
      )}
      {!isLoading && agents?.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-sm">No agents yet — process a permit to discover patterns</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents?.map((spec) => (
          <AgentCard key={spec.id} spec={spec} sessionId={sessionId} />
        ))}
      </div>
    </div>
  )
}
