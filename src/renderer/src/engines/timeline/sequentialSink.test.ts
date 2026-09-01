import { describe, expect, it, vi } from 'vitest'
import { createSequentialSink, type SequentialSource } from './sequentialSink'
import type { VideoSampleLike } from './decoderPool'

const sample = (id: string): VideoSampleLike => ({
  toVideoFrame: () => id as unknown as VideoFrame,
  close: vi.fn(),
})

/** A source that records every iterator it opened, and the timestamps each one saw. */
const sourceOf = (): SequentialSource & { batches: number[][] } => {
  const batches: number[][] = []
  return {
    batches,
    samplesAtTimestamps: timestamps => ({
      async *[Symbol.asyncIterator]() {
        const seen: number[] = []
        batches.push(seen)
        for await (const time of timestamps) {
          seen.push(time)
          yield sample(`${time}`)
        }
      },
    }),
    close: vi.fn(),
  }
}

describe('sequential video sink', () => {
  it('keeps one decoder iterator across forward timestamps', async () => {
    const source = sourceOf()
    const sink = createSequentialSink(source)

    await sink.getSample(0)
    await sink.getSample(0.04)
    await sink.getSample(0.08)

    expect(source.batches).toHaveLength(1)
    expect(source.batches[0]).toEqual([0, 0.04, 0.08])
  })

  it('answers overlapping asks in order, never two next() at once', async () => {
    const source = sourceOf()
    const sink = createSequentialSink(source)

    const first = sink.getSample(0)
    const second = sink.getSample(0.04)
    await Promise.all([first, second])

    expect(source.batches).toHaveLength(1)
    expect(source.batches[0]).toEqual([0, 0.04])
  })

  it('opens a new iterator when the playhead jumps backward', async () => {
    const source = sourceOf()
    const sink = createSequentialSink(source)

    await sink.getSample(1)
    await sink.getSample(0.2)

    expect(source.batches).toHaveLength(2)
    expect(source.batches[0]).toEqual([1])
    expect(source.batches[1]).toEqual([0.2])
  })

  it('stays on the same iterator across a forward skip, which is a dropped frame', async () => {
    const source = sourceOf()
    const sink = createSequentialSink(source)

    await sink.getSample(0)
    await sink.getSample(0.5)

    expect(source.batches).toHaveLength(1)
    expect(source.batches[0]).toEqual([0, 0.5])
  })

  it('closes the source once, and refuses samples afterwards', async () => {
    const source = sourceOf()
    const sink = createSequentialSink(source)

    await sink.getSample(0)
    sink.close()
    sink.close()

    expect(source.close).toHaveBeenCalledTimes(1)
    expect(await sink.getSample(1)).toBeNull()
  })

  it('holds a decoder and is not a still', () => {
    const sink = createSequentialSink(sourceOf())
    expect(sink.holdsDecoder).toBe(true)
    expect(sink.stable).toBe(false)
  })
})
