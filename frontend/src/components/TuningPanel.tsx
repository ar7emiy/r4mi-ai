import { useState } from 'react'
import { useForkAgent } from '@/hooks/useAgentMarket'
import { useR4miStore, type AgentSpec } from '@/store/r4mi.store'
import { cn } from '@/lib/utils'

interface Props {
  originalSpec: AgentSpec
  onClose: () => void
  onPublished?: (forked: AgentSpec) => void
}

export function TuningPanel({ originalSpec, onClose, onPublished }: Props) {
  const { sessionId } = useR4miStore()
  const forkMut = useForkAgent()
  const [editedSteps, setEditedSteps] = useState<unknown[]>(originalSpec.action_sequence)
  const [userId] = useState('demo_user')

  const originalSteps = originalSpec.action_sequence as Array<Record<string, unknown>>
  const editedStepsTyped = editedSteps as Array<Record<string, unknown>>

  const changedIndices = new Set(
    originalSteps
      .map((_, i) => i)
      .filter((i) => JSON.stringify(originalSteps[i]) !== JSON.stringify(editedStepsTyped[i]))
  )

  const deltaRatio =
    changedIndices.size / Math.max(originalSteps.length, editedStepsTyped.length)
  const originalShare = Math.round((1 - deltaRatio) * 100)
  const tunerShare = Math.round(deltaRatio * 100)

  const handlePublish = () => {
    forkMut.mutate(
      {
        agentId: originalSpec.id,
        tuning_delta: { action_sequence: editedSteps },
        user_id: userId,
      },
      {
        onSuccess: (forked) => {
          onPublished?.(forked)
          onClose()
        },
      }
    )
  }

  const updateStep = (idx: number, key: string, value: string) => {
    setEditedSteps((prev) => {
      const updated = [...(prev as Array<Record<string, unknown>>)]
      updated[idx] = { ...updated[idx], [key]: value }
      return updated
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-3xl mx-4 bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-sm font-semibold text-white">Tune Agent: {originalSpec.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Edit steps — changes are tracked for contribution split</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg">×</button>
        </div>

        {/* Contribution preview */}
        {changedIndices.size > 0 && (
          <div className="px-5 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center gap-3 text-xs">
            <span className="text-gray-400">Contribution split:</span>
            <span className="text-gray-300">
              Original authors: <strong className="text-white">{originalShare}%</strong>
            </span>
            <span className="text-gray-300">
              Your tuning: <strong className="text-indigo-300">{tunerShare}%</strong>
            </span>
          </div>
        )}

        {/* Side-by-side diff */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 divide-x divide-gray-700">
            {/* Original */}
            <div className="p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Original</p>
              <div className="space-y-2">
                {originalSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-2 rounded-lg text-xs border',
                      changedIndices.has(idx)
                        ? 'border-red-500/30 bg-red-500/5 text-red-300'
                        : 'border-gray-700 bg-gray-800 text-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{idx + 1}.</span>
                      <span className="font-mono text-[11px] text-gray-400">{step.action_type as string}</span>
                      <span className="text-gray-500">{step.screen_name as string}</span>
                    </div>
                    {step.element_value && (
                      <p className="mt-0.5 ml-5 text-[11px] text-gray-500">→ {step.element_value as string}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Editable */}
            <div className="p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Tuned</p>
              <div className="space-y-2">
                {editedStepsTyped.map((step, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-2 rounded-lg text-xs border',
                      changedIndices.has(idx)
                        ? 'border-indigo-500/40 bg-indigo-500/10'
                        : 'border-gray-700 bg-gray-800'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-600">{idx + 1}.</span>
                      <span className="font-mono text-[11px] text-gray-400">{step.action_type as string}</span>
                      <span className="text-gray-500">{step.screen_name as string}</span>
                    </div>
                    <input
                      className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-[11px] text-gray-300
                                 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      value={(step.element_value as string) || ''}
                      onChange={(e) => updateStep(idx, 'element_value', e.target.value)}
                      placeholder="value…"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 pt-3 border-t border-gray-700 flex gap-2">
          <button
            onClick={handlePublish}
            disabled={forkMut.isPending || changedIndices.size === 0}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium
                       bg-indigo-600 hover:bg-indigo-500 text-white transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {forkMut.isPending ? 'Publishing…' : 'Publish Fork'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
