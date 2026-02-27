import { useR4miStore } from '@/store/r4mi.store'
import { cn } from '@/lib/utils'

const SCREEN_EMOJIS: Record<string, string> = {
  INBOX: '📥',
  GIS_SYSTEM: '🗺️',
  CODE_ENFORCEMENT: '⚠️',
  POLICY_WIKI: '📖',
  PERMIT_FORM: '📋',
}

/**
 * AgentDemo shows a live step-by-step playback of a NarrowAgent executing.
 * It receives AGENT_DEMO_STEP SSE events and renders each action.
 * The parent component (CRM or main app) is responsible for passing
 * demoFieldValues from the store to ActionForm's externalValues prop.
 */
export function AgentDemo() {
  const { demoSteps, currentDemoStep, activeAgents, showAgentDemo, setShowAgentDemo } =
    useR4miStore()

  const runningAgent = activeAgents.find((a) => a.status === 'running' || a.status === 'completed')

  if (!showAgentDemo || !runningAgent) return null

  const isComplete = runningAgent.status === 'completed' || runningAgent.status === 'error'
  const progressPct =
    demoSteps.length > 0 && runningAgent.total_steps
      ? Math.round(((currentDemoStep + 1) / runningAgent.total_steps) * 100)
      : 0

  return (
    <div className="fixed right-4 bottom-16 w-80 z-50">
      <div
        className={cn(
          'bg-gray-900 rounded-xl border shadow-2xl overflow-hidden',
          isComplete
            ? runningAgent.status === 'completed'
              ? 'border-emerald-500/50'
              : 'border-red-500/50'
            : 'border-indigo-500/40'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'h-2 w-2 rounded-full flex-shrink-0',
                isComplete
                  ? runningAgent.status === 'completed'
                    ? 'bg-emerald-400'
                    : 'bg-red-400'
                  : 'bg-indigo-400 animate-pulse'
              )}
            />
            <span className="text-xs font-medium text-white truncate">{runningAgent.name}</span>
          </div>
          <button
            onClick={() => setShowAgentDemo(false)}
            className="text-gray-600 hover:text-gray-400 text-sm leading-none ml-2 flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        {!isComplete && (
          <div className="h-0.5 bg-gray-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Steps */}
        <div className="max-h-64 overflow-y-auto px-3 py-2 space-y-1.5">
          {demoSteps.map((step, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 transition-colors',
                idx === currentDemoStep && !isComplete
                  ? 'bg-indigo-500/15 border border-indigo-500/30'
                  : 'text-gray-500'
              )}
            >
              <span className="flex-shrink-0 mt-0.5 text-base leading-none">
                {SCREEN_EMOJIS[step.screen_name] ?? '⬡'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('font-mono text-[11px]', idx <= currentDemoStep ? 'text-gray-300' : 'text-gray-600')}>
                    {step.field_id || step.screen_name}
                  </span>
                  {step.value && (
                    <span className="text-indigo-400 font-medium truncate max-w-[80px]">
                      = {step.value}
                    </span>
                  )}
                </div>
                {step.rationale && idx === currentDemoStep && (
                  <p className="text-gray-500 mt-0.5 text-[10px] italic line-clamp-2">
                    {step.rationale}
                  </p>
                )}
              </div>
              {idx < currentDemoStep && (
                <span className="text-emerald-400 flex-shrink-0">✓</span>
              )}
              {idx === currentDemoStep && !isComplete && (
                <span className="text-indigo-400 flex-shrink-0 animate-pulse">▶</span>
              )}
            </div>
          ))}
        </div>

        {/* Completion state */}
        {isComplete && (
          <div
            className={cn(
              'px-3 py-3 border-t text-xs font-medium flex items-center gap-2',
              runningAgent.status === 'completed'
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                : 'border-red-500/30 text-red-400 bg-red-500/5'
            )}
          >
            <span>{runningAgent.status === 'completed' ? '✓' : '✗'}</span>
            <span>
              {runningAgent.status === 'completed'
                ? `Completed ${demoSteps.length} steps successfully`
                : 'Flagged for human review'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
