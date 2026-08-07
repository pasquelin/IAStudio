import { describe, expect, it, vi } from 'vitest'
import { createDecoderPool, secondsToUs, usToSeconds } from './decoder-pool'

const fakeSink = (assetId: string) => ({
  getSample: vi.fn(async (seconds: number) => ({
    toVideoFrame: () => `${assetId}@${seconds}` as unknown as VideoFrame,
    close: vi.fn(),
  })),
  close: vi.fn(),
})

describe('decoder pool', () => {
  it('converts microseconds to the float seconds mediabunny speaks, and back', () => {
    expect(usToSeconds(1_500_000)).toBe(1.5)
    expect(secondsToUs(1.5)).toBe(1_500_000)
  })

  it('opens one sink per asset, not one per call', async () => {
    const open = vi.fn(async (assetId: string) => fakeSink(assetId))
    const pool = createDecoderPool({ open, maxDecoders: 3 })

    await pool.frameAt('a', 0)
    await pool.frameAt('a', 1_000_000)

    expect(open).toHaveBeenCalledTimes(1)
    expect(pool.openCount()).toBe(1)
  })

  it('asks the sink for the time in seconds', async () => {
    const sink = fakeSink('a')
    const pool = createDecoderPool({ open: async () => sink, maxDecoders: 3 })

    await pool.frameAt('a', 2_500_000)

    expect(sink.getSample).toHaveBeenCalledWith(2.5)
  })

  it('evicts the least recently used sink past the limit', async () => {
    const sinks = new Map<string, ReturnType<typeof fakeSink>>()
    const open = vi.fn(async (assetId: string) => {
      const sink = fakeSink(assetId)
      sinks.set(assetId, sink)
      return sink
    })
    const pool = createDecoderPool({ open, maxDecoders: 2 })

    await pool.frameAt('a', 0)
    await pool.frameAt('b', 0)
    await pool.frameAt('a', 1_000_000)
    await pool.frameAt('c', 0)

    expect(pool.openCount()).toBe(2)
    // 'b' was the least recently used, so it is the one that had to go.
    expect(sinks.get('b')?.close).toHaveBeenCalled()
    expect(sinks.get('a')?.close).not.toHaveBeenCalled()
  })

  it('closes every sink on dispose, since a decoder outliving its engine is a leak', async () => {
    const sinks: ReturnType<typeof fakeSink>[] = []
    const open = vi.fn(async (assetId: string) => {
      const sink = fakeSink(assetId)
      sinks.push(sink)
      return sink
    })
    const pool = createDecoderPool({ open, maxDecoders: 3 })

    await pool.frameAt('a', 0)
    await pool.frameAt('b', 0)
    pool.dispose()

    expect(sinks.every(sink => sink.close.mock.calls.length === 1)).toBe(true)
    expect(pool.openCount()).toBe(0)
  })

  it('returns null when the asset cannot be opened, rather than throwing into a paint loop', async () => {
    const pool = createDecoderPool({
      open: async () => {
        throw new Error('undecodable')
      },
      maxDecoders: 3,
    })

    await expect(pool.frameAt('a', 0)).resolves.toBeNull()
  })

  it('does not reopen an asset that failed on every frame', async () => {
    const open = vi.fn(async () => {
      throw new Error('undecodable')
    })
    const pool = createDecoderPool({ open, maxDecoders: 3 })

    await pool.frameAt('a', 0)
    await pool.frameAt('a', 40_000)

    // Retrying a broken asset sixty times a second is how a paint loop becomes a stutter.
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('releases one asset without touching the others', async () => {
    const sinks = new Map<string, ReturnType<typeof fakeSink>>()
    const pool = createDecoderPool({
      open: async (assetId: string) => {
        const sink = fakeSink(assetId)
        sinks.set(assetId, sink)
        return sink
      },
      maxDecoders: 3,
    })

    await pool.frameAt('a', 0)
    await pool.frameAt('b', 0)
    pool.release('a')

    expect(pool.openCount()).toBe(1)
    expect(sinks.get('a')?.close).toHaveBeenCalled()
    expect(sinks.get('b')?.close).not.toHaveBeenCalled()
  })
})
