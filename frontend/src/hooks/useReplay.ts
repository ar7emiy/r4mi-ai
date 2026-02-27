import { useCallback, useEffect, useRef, useState } from 'react'
import { useR4miStore } from '@/store/r4mi.store'

const DEFAULT_FRAME_DURATION_MS = 2000  // 0.5x speed baseline

export function useReplay() {
  const { replayFrames, currentReplayFrameIdx, setCurrentReplayFrameIdx } = useR4miStore()

  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) {
      clearTimeout(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const scheduleNext = useCallback(
    (idx: number) => {
      if (idx >= replayFrames.length - 1) {
        stopPlayback()
        return
      }

      const currentFrame = replayFrames[idx]
      const nextFrame = replayFrames[idx + 1]

      // Use actual recorded interval, capped between 500ms and 4000ms
      const interval = nextFrame
        ? Math.min(Math.max(nextFrame.timestamp_ms - currentFrame.timestamp_ms, 500), 4000)
        : DEFAULT_FRAME_DURATION_MS

      intervalRef.current = setTimeout(() => {
        const next = idx + 1
        setCurrentReplayFrameIdx(next)
        scheduleNext(next)
      }, interval)
    },
    [replayFrames, setCurrentReplayFrameIdx, stopPlayback]
  )

  const play = useCallback(() => {
    if (currentReplayFrameIdx >= replayFrames.length - 1) {
      setCurrentReplayFrameIdx(0)
    }
    setIsPlaying(true)
    scheduleNext(currentReplayFrameIdx)
  }, [currentReplayFrameIdx, replayFrames.length, setCurrentReplayFrameIdx, scheduleNext])

  const pause = useCallback(() => {
    stopPlayback()
  }, [stopPlayback])

  const scrubTo = useCallback(
    (idx: number) => {
      stopPlayback()
      setCurrentReplayFrameIdx(Math.max(0, Math.min(idx, replayFrames.length - 1)))
    },
    [replayFrames.length, setCurrentReplayFrameIdx, stopPlayback]
  )

  const stepBack = useCallback(() => {
    scrubTo(currentReplayFrameIdx - 1)
  }, [currentReplayFrameIdx, scrubTo])

  const stepForward = useCallback(() => {
    scrubTo(currentReplayFrameIdx + 1)
  }, [currentReplayFrameIdx, scrubTo])

  // Cleanup on unmount
  useEffect(() => () => stopPlayback(), [stopPlayback])

  const currentFrame = replayFrames[currentReplayFrameIdx] ?? null

  return {
    frames: replayFrames,
    currentFrame,
    currentIndex: currentReplayFrameIdx,
    totalFrames: replayFrames.length,
    isPlaying,
    play,
    pause,
    scrubTo,
    stepBack,
    stepForward,
  }
}
