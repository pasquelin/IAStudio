import { secondsToUs } from '@shared/domain/time'
import type { Us } from './timelineState'

export type ClockDeps = {
  /** `AudioContext.currentTime`, in seconds, or null when no audio is playing. */
  audioTime: () => number | null
  /** `performance.now()`, in milliseconds. */
  monotonic: () => number
}

export type Clock = {
  start: (from: Us) => void
  stop: () => void
  now: () => Us
}

/**
 * The audio context is the master clock whenever there is one: driving audio from
 * `requestAnimationFrame` drifts audibly in under a minute.
 */
export function createClock({ audioTime, monotonic }: ClockDeps): Clock {
  let origin: { at: number; audio: boolean; from: Us } | null = null
  let frozen: Us = 0

  const elapsed = (): Us => {
    if (!origin) return frozen

    const audio = audioTime()
    if (origin.audio && audio !== null) {
      return origin.from + secondsToUs(audio - origin.at)
    }
    return origin.from + Math.round((monotonic() - origin.at) * 1_000)
  }

  return {
    start: from => {
      const audio = audioTime()
      origin = { at: audio ?? monotonic(), audio: audio !== null, from }
    },
    stop: () => {
      frozen = elapsed()
      origin = null
    },
    now: elapsed,
  }
}
