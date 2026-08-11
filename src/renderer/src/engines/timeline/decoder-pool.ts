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
  /**
   * Whether this sink holds a hardware decoder. A still picture holds a bitmap and none, and
   * counting it against the decoder budget evicted a rush that did need one.
   */
  holdsDecoder: boolean
}

export type DecoderPoolDeps = {
  open: (assetId: string) => Promise<SinkLike>
  maxDecoders: number
  /** Pictures hold no decoder, so they answer to their own ceiling: memory, not silicon. */
  maxPictures: number
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

export function createDecoderPool({
  open,
  maxDecoders,
  maxPictures,
}: DecoderPoolDeps): DecoderPool {
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
  /** Learned when an opening settles. Until then a sink is counted against the decoders. */
  const pictures = new Set<string>()

  const touch = (assetId: string, opening: Promise<SinkLike>): void => {
    sinks.delete(assetId)
    sinks.set(assetId, opening)
  }

  const forget = (assetId: string): void => {
    sinks.delete(assetId)
    pictures.delete(assetId)
  }

  /** Closes whenever it finishes opening. A failed open is `sinkFor`'s business, not ours. */
  const closeLater = (opening: Promise<SinkLike>): void => {
    void opening.then(sink => sink.close()).catch(() => {})
  }

  /**
   * Two ceilings, because the two kinds are scarce for different reasons. Insertion order is
   * recency order, so dropping from the front drops the least recently used of the kind.
   */
  const evict = (): void => {
    dropOldest(assetId => !pictures.has(assetId), sinks.size - pictures.size - maxDecoders)
    dropOldest(assetId => pictures.has(assetId), pictures.size - maxPictures)
  }

  const dropOldest = (counted: (assetId: string) => boolean, over: number): void => {
    let left = over
    for (const assetId of [...sinks.keys()]) {
      if (left <= 0) return
      if (!counted(assetId)) continue

      const opening = sinks.get(assetId)
      forget(assetId)
      if (opening) closeLater(opening)
      left -= 1
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
      const sink = await opening
      // Learned only here: until it settled, this one was counted as a decoder it never took.
      if (!sink.holdsDecoder && sinks.has(assetId)) {
        pictures.add(assetId)
        evict()
      }
      return sink
    } catch {
      // Remembered, not retried: reopening a broken asset sixty times a second is a stutter,
      // and the clip shows a placeholder either way.
      forget(assetId)
      undecodable.add(assetId)
      return null
    }
  }

  return {
    frameAt: async (assetId, time) => {
      const sink = await sinkFor(assetId)
      if (!sink) return null

      try {
        const sample = await sink.getSample(usToSeconds(time))
        if (!sample) return null

        const frame = sample.toVideoFrame()
        sample.close()
        return frame
      } catch {
        // Same promise as a failed open, for the same reason: a throw here reaches the caller
        // mid-paint, and the frames it already swapped in would never be drawn. Not remembered
        // as undecodable — one position failing does not condemn the rush.
        return null
      }
    },

    openCount: () => sinks.size,

    release: assetId => {
      const opening = sinks.get(assetId)
      forget(assetId)
      if (opening) closeLater(opening)
      undecodable.delete(assetId)
    },

    dispose: () => {
      for (const opening of sinks.values()) closeLater(opening)
      sinks.clear()
      pictures.clear()
      undecodable.clear()
    },
  }
}
