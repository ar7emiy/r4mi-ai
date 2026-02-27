import { useR4miStore } from '@/store/r4mi.store'
import { useReplay } from '@/hooks/useReplay'
import { cn } from '@/lib/utils'

interface Props {
  sessionId: string
  onConfirm: (removedIndices: number[]) => void
  onClose: () => void
}

const SCREEN_COLORS: Record<string, string> = {
  INBOX: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  GIS_SYSTEM: 'bg-green-500/20 text-green-300 border-green-500/30',
  CODE_ENFORCEMENT: 'bg-red-500/20 text-red-300 border-red-500/30',
  POLICY_WIKI: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  PERMIT_FORM: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
}

const EVENT_ICONS: Record<string, string> = {
  navigate: '→',
  screen_switch: '⬆',
  click: '◉',
  input: '✎',
  submit: '✓',
}

export function SessionReplay({ sessionId, onConfirm, onClose }: Props) {
  const { setShowReplay } = useR4miStore()
  const { frames, currentFrame, currentIndex, totalFrames, isPlaying, play, pause, scrubTo, stepBack, stepForward } =
    useReplay()

  const handleConfirm = () => {
    onConfirm([])  // No removals — user approved as-is
    setShowReplay(false)
    onClose()
  }

  if (totalFrames === 0) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60">
        <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm">
          <p className="text-gray-400 text-sm">Loading replay frames…</p>
          <button onClick={onClose} className="mt-4 text-xs text-gray-500 hover:text-gray-300">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70">
      <div
        className="relative w-full max-w-2xl mx-4 bg-gray-900 rounded-xl shadow-2xl
                   border border-gray-700 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-white">Session Replay</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Step {currentIndex + 1} of {totalFrames} — 0.5× speed
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${((currentIndex + 1) / totalFrames) * 100}%` }}
          />
        </div>

        {/* Current frame highlight */}
        <div className="px-5 py-4 border-b border-gray-800">
          {currentFrame && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40
                              flex items-center justify-center text-lg">
                {EVENT_ICONS[currentFrame.event.event_type as string] ?? '◇'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{currentFrame.action_label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded-full border',
                      SCREEN_COLORS[currentFrame.screen_name] ??
                        'bg-gray-700 text-gray-300 border-gray-600'
                    )}
                  >
                    {currentFrame.screen_name.replace(/_/g, ' ')}
                  </span>
                  {currentFrame.highlighted_element && (
                    <span className="text-[11px] text-gray-500 font-mono truncate">
                      {currentFrame.highlighted_element}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline — scrollable list of all frames */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1">
          {frames.map((frame, idx) => (
            <button
              key={frame.frame_index}
              onClick={() => scrubTo(idx)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left transition-colors',
                idx === currentIndex
                  ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-200'
                  : 'text-gray-400 hover:bg-gray-800 border border-transparent'
              )}
            >
              <span className="text-gray-600 w-6 text-right flex-shrink-0">{idx + 1}</span>
              <span className="flex-shrink-0">{EVENT_ICONS[frame.event.event_type as string] ?? '◇'}</span>
              <span className="truncate">{frame.action_label}</span>
              <span
                className={cn(
                  'ml-auto px-1.5 py-0.5 rounded-full text-[10px] border flex-shrink-0',
                  SCREEN_COLORS[frame.screen_name] ?? 'bg-gray-700 text-gray-400 border-gray-600'
                )}
              >
                {frame.screen_name.split('_')[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Playback controls */}
        <div className="px-5 py-3 border-t border-gray-700 flex items-center gap-2">
          <button
            onClick={stepBack}
            disabled={currentIndex === 0}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous step"
          >
            ◀
          </button>
          <button
            onClick={isPlaying ? pause : play}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={stepForward}
            disabled={currentIndex >= totalFrames - 1}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next step"
          >
            ▶
          </button>
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentIndex}
            onChange={(e) => scrubTo(Number(e.target.value))}
            className="flex-1 mx-2 accent-indigo-500"
          />
        </div>

        {/* Confirmation actions */}
        <div className="px-5 pb-4 pt-2 flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium
                       bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            ✓ Confirm this sequence
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400
                       hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
