import { useR4miStore, type OptimizationOpportunity } from '@/store/r4mi.store'

interface Props {
  opportunity: OptimizationOpportunity
  onClose: () => void
}

export function OptimizationTab({ opportunity, onClose }: Props) {
  const { setShowReplay } = useR4miStore()

  const handleWatchReplay = () => {
    onClose()
    setShowReplay(true)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel — slides up from bottom, sits above TabProgressionBar */}
      <div
        className="relative pointer-events-auto w-full max-w-lg mb-14 mx-4 rounded-t-xl
                   bg-gray-900 border border-amber-500/30 shadow-2xl
                   animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <h2 className="text-sm font-semibold text-white">
                Optimization Opportunity
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-[18px]">
              {opportunity.permit_type.replace(/_/g, ' ')} permits
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none ml-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-300">{opportunity.message}</p>

          {/* Confidence meter */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Pattern confidence</span>
              <span className="text-amber-300 font-medium">
                {Math.round(opportunity.confidence * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all"
                style={{ width: `${Math.round(opportunity.confidence * 100)}%` }}
              />
            </div>
          </div>

          {/* Screens involved */}
          {opportunity.screens.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-400">Screens visited each time:</p>
              <div className="flex flex-wrap gap-1.5">
                {opportunity.screens.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 text-[11px] rounded-full bg-gray-700 text-gray-300 border border-gray-600"
                  >
                    {s.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            r4mi-ai observed this {opportunity.sessions_count}{' '}
            {opportunity.sessions_count === 1 ? 'time' : 'times'} across sessions.
            Review the replay and confirm when you're ready — no rush.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleWatchReplay}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium
                       bg-amber-500 hover:bg-amber-400 text-gray-900 transition-colors"
          >
            Watch Replay →
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400
                       hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
