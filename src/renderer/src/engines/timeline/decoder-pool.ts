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
  // Insertion order is recency order: re-inserting on every use is what makes a Map an LRU.
  const sinks = new Map<string, SinkLike>()
  const undecodable = new Set<string>()

  const touch = (assetId: string, sink: SinkLike): void => {
    sinks.delete(assetId)
    sinks.set(assetId, sink)
  }

  const evict = (): void => {
    while (sinks.size > maxDecoders) {
      const oldest = sinks.keys().next()
      if (oldest.done) return
      sinks.get(oldest.value)?.close()
      sinks.delete(oldest.value)
    }
  }

  const sinkFor = async (assetId: string): Promise<SinkLike | null> => {
    const existing = sinks.get(assetId)
    if (existing) {
      touch(assetId, existing)
      return existing
    }
    if (undecodable.has(assetId)) return null

    try {
      const opened = await open(assetId)
      touch(assetId, opened)
      evict()
      return opened
    } catch {
      // Remembered, not retried: reopening a broken asset sixty times a second is a stutter,
      // and the clip shows a placeholder either way.
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
      sinks.get(assetId)?.close()
      sinks.delete(assetId)
      undecodable.delete(assetId)
    },

    dispose: () => {
      for (const sink of sinks.values()) sink.close()
      sinks.clear()
      undecodable.clear()
    },
  }
}
