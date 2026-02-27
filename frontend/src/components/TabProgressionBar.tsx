import { useState } from 'react'
import { useR4miStore, type ActiveAgent } from '@/store/r4mi.store'
import { OptimizationTab } from './OptimizationTab'
import { cn } from '@/lib/utils'

const TRUST_COLORS: Record<string, string> = {
  supervised: 'bg-blue-500',
  autonomous: 'bg-emerald-500',
  stale: 'bg-red-500',
}

const STATUS_DOTS: Record<string, string> = {
  idle: 'bg-gray-400',
  running: 'bg-amber-400 animate-pulse',
  flagging: 'bg-red-400 animate-ping',
  completed: 'bg-emerald-400',
  error: 'bg-red-500',
}

function AgentTab({ agent }: { agent: ActiveAgent }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs',
        'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors'
      )}
    >
      <span
        className={cn('h-2 w-2 rounded-full flex-shrink-0', STATUS_DOTS[agent.status])}
        title={agent.status}
      />
      <span className="font-medium truncate max-w-[120px]">{agent.name}</span>
      <span
        className={cn(
          'px-1 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide text-white',
          TRUST_COLORS[agent.trust_level]
        )}
      >
        {agent.trust_level[0]}
      </span>
      {agent.current_step !== undefined && agent.total_steps !== undefined && (
        <span className="text-gray-400">
          {agent.current_step + 1}/{agent.total_steps}
        </span>
      )}
    </div>
  )
}

export function TabProgressionBar() {
  const { activeAgents, optimizationOpportunity, showOptimizationTab, setShowOptimizationTab, sseConnected } =
    useR4miStore()

  return (
    <>
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 h-12 z-50',
          'bg-gray-900 border-t border-gray-700',
          'flex items-center gap-2 px-4'
        )}
      >
        {/* SSE connection indicator */}
        <span
          title={sseConnected ? 'Connected' : 'Disconnected'}
          className={cn(
            'h-1.5 w-1.5 rounded-full flex-shrink-0 mr-1',
            sseConnected ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'
          )}
        />

        {/* Optimization opportunity glow tab */}
        {optimizationOpportunity && (
          <button
            onClick={() => setShowOptimizationTab(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium',
              'border-amber-500/60 bg-amber-500/15 text-amber-300',
              'hover:bg-amber-500/25 transition-colors',
              'animate-pulse'
            )}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            Optimization Opportunity
            <span className="bg-amber-500/30 text-amber-200 text-[10px] px-1 rounded">
              {Math.round(optimizationOpportunity.confidence * 100)}%
            </span>
          </button>
        )}

        {/* Active agent tabs */}
        {activeAgents.map((agent) => (
          <AgentTab key={agent.id} agent={agent} />
        ))}

        {activeAgents.length === 0 && !optimizationOpportunity && (
          <span className="text-xs text-gray-600 italic">
            r4mi-ai observing passively…
          </span>
        )}

        {/* Right-aligned branding */}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-600">
          <span>r4mi-ai</span>
        </div>
      </div>

      {showOptimizationTab && optimizationOpportunity && (
        <OptimizationTab
          opportunity={optimizationOpportunity}
          onClose={() => setShowOptimizationTab(false)}
        />
      )}
    </>
  )
}
