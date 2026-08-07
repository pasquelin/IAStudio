import type { Us } from './timeline-state'

/**
 * The only place microseconds meet mediabunny's float seconds.
 *
 * A consumer GPU offers two to four hardware decoders: four tracks playing without a bound is
 * the collapse this pool exists to prevent, and `openCount` is what the status bar reports.
 */
export type VideoSampleLike = {
  toVideoFrame: () => VideoFrame
  close: () => void
}

export type SinkLike = {
  getSample: (seconds: number) => Promise<VideoSampleLike | null>
  close: () => void
}

export type DecoderPoolDeps = {
  open: (assetId: string) => Promise<SinkLike>
  maxDecoders: number
}

export type DecoderPool = {
  frameAt: (assetId: string, time: Us) => Promise<VideoFrame | null>
  openCount: () => number
  release: (assetId: string) => void
  dispose: () => void
}

export function usToSeconds(time: Us): number {
  return time / 1_000_000
}

export function secondsToUs(value: number): Us {
  return Math.round(value * 1_000_000)
}

export function createDecoderPool({ open, maxDecoders }: DecoderPoolDeps): DecoderPool {
  /**
   * Insertion order is recency order: re-inserting on every use is what makes a Map an LRU.
   *
   * It holds the *opening*, not the opened sink. Two seeks a frame apart, or two tracks on one
   * rush, both miss while the first is still opening: awaiting first would have each of them
   * open a decoder, and the second overwrite the first here — a hardware decoder held by
   * nothing, for the session, on a slot count the OS caps at a handful.
   */
  const sinks = new Map<string, Promise<SinkLike>>()
  const undecodable = new Set<string>()

  const touch = (assetId: string, opening: Promise<SinkLike>): void => {
    sinks.delete(assetId)
    sinks.set(assetId, opening)
  }

  /** Closes whenever it finishes opening. A failed open is `sinkFor`'s business, not ours. */
  const closeLater = (opening: Promise<SinkLike>): void => {
    void opening.then(sink => sink.close()).catch(() => {})
  }

  const evict = (): void => {
    while (sinks.size > maxDecoders) {
      const oldest = sinks.keys().next()
      if (oldest.done) return

      const opening = sinks.get(oldest.value)
      sinks.delete(oldest.value)
      if (opening) closeLater(opening)
    }
  }

  const sinkFor = async (assetId: string): Promise<SinkLike | null> => {
    if (undecodable.has(assetId)) return null

    let opening = sinks.get(assetId)
    if (opening) touch(assetId, opening)
    else {
      opening = open(assetId)
      sinks.set(assetId, opening)
      evict()
    }

    try {
      return await opening
    } catch {
      // Remembered, not retried: reopening a broken asset sixty times a second is a stutter,
      // and the clip shows a placeholder either way.
      sinks.delete(assetId)
      undecodable.add(assetId)
      return null
    }
  }

  return {
    frameAt: async (assetId, time) => {
      const sink = await sinkFor(assetId)
      if (!sink) return null

      const sample = await sink.getSample(usToSeconds(time))
      if (!sample) return null

      const frame = sample.toVideoFrame()
      sample.close()
      return frame
    },

    openCount: () => sinks.size,

    release: assetId => {
      const opening = sinks.get(assetId)
      sinks.delete(assetId)
      if (opening) closeLater(opening)
      undecodable.delete(assetId)
    },

    dispose: () => {
      for (const opening of sinks.values()) closeLater(opening)
      sinks.clear()
      undecodable.clear()
    },
  }
}
