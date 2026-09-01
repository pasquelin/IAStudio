import type { SinkLike, VideoSampleLike } from './decoderPool'

/**
 * mediabunny's sparse `getSample` opens a decoder per call. `samplesAtTimestamps` keeps one
 * decoder for a monotone run, which is what playback actually is.
 */
export type SequentialSource = {
  samplesAtTimestamps: (timestamps: AsyncIterable<number>) => AsyncIterable<VideoSampleLike | null>
  close: () => void
}

type Feed = {
  push: (time: number) => void
  end: () => void
  timestamps: AsyncIterable<number>
}

function createFeed(): Feed {
  const queued: number[] = []
  let wake: (() => void) | null = null
  let done = false

  const notify = (): void => {
    wake?.()
    wake = null
  }

  return {
    push: time => {
      if (done) return
      queued.push(time)
      notify()
    },
    end: () => {
      done = true
      notify()
    },
    timestamps: {
      async *[Symbol.asyncIterator]() {
        while (true) {
          while (queued.length > 0) {
            const next = queued.shift()
            if (next !== undefined) yield next
          }
          if (done) return
          await new Promise<void>(resolve => {
            wake = resolve
          })
        }
      },
    },
  }
}

export function createSequentialSink(source: SequentialSource): SinkLike {
  let feed: Feed | null = null
  let iterator: AsyncIterator<VideoSampleLike | null> | null = null
  let last = Number.NEGATIVE_INFINITY
  let closed = false
  let chain: Promise<void> = Promise.resolve()

  const start = (): void => {
    feed = createFeed()
    iterator = source.samplesAtTimestamps(feed.timestamps)[Symbol.asyncIterator]()
  }

  const stop = async (): Promise<void> => {
    feed?.end()
    const previous = iterator
    feed = null
    iterator = null
    last = Number.NEGATIVE_INFINITY
    const leftover = await previous?.return?.()
    leftover?.value?.close()
  }

  const sampleAt = async (seconds: number): Promise<VideoSampleLike | null> => {
    if (closed) return null

    if (!iterator || !feed || seconds < last) {
      await stop()
      if (closed) return null
      start()
    }

    const current = feed
    const walk = iterator
    if (!current || !walk) return null

    last = seconds
    current.push(seconds)
    const step = await walk.next()
    return step.value ?? null
  }

  return {
    holdsDecoder: true,
    stable: false,
    getSample: seconds => {
      const next = chain.then(
        () => sampleAt(seconds),
        () => sampleAt(seconds),
      )
      chain = next.then(
        () => undefined,
        () => undefined,
      )
      return next
    },
    close: () => {
      if (closed) return
      closed = true
      chain = chain.then(stop, stop)
      source.close()
    },
  }
}
