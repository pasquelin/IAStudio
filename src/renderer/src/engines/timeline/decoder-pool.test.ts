import { describe, expect, it, vi } from 'vitest'
import { createDecoderPool, type VideoSampleLike } from './decoder-pool'

const fakeSink = (assetId: string, holdsDecoder = true) => ({
  getSample: vi.fn(async (seconds: number) => ({
    toVideoFrame: () => `${assetId}@${seconds}` as unknown as VideoFrame,
    close: vi.fn(),
  })),
  close: vi.fn(),
  holdsDecoder,
})

/** A pool over a fixed cast: `pictures` names the assets whose sink holds no decoder. */
const poolOver = (
  assets: readonly string[],
  pictures: readonly string[],
  ceilings: { maxDecoders: number; maxPictures: number },
) => {
  const sinks = new Map(assets.map(id => [id, fakeSink(id, !pictures.includes(id))]))
  const open = vi.fn(async (assetId: string) => {
    const sink = sinks.get(assetId)
    if (!sink) throw new Error(`no sink for ${assetId}`)
    return sink
  })
  return { sinks, open, pool: createDecoderPool({ open, ...ceilings }) }
}

describe('decoder pool', () => {
  it('opens one sink per asset, not one per call', async () => {
    const open = vi.fn(async (assetId: string) => fakeSink(assetId))
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await pool.frameAt('a', 0)
    await pool.frameAt('a', 1_000_000)

    expect(open).toHaveBeenCalledTimes(1)
    expect(pool.openCount()).toBe(1)
  })

  it('asks the sink for the time in seconds', async () => {
    const sink = fakeSink('a')
    const pool = createDecoderPool({ open: async () => sink, maxDecoders: 3, maxPictures: 2 })

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
    const pool = createDecoderPool({ open, maxDecoders: 2, maxPictures: 2 })

    await pool.frameAt('a', 0)
    await pool.frameAt('b', 0)
    await pool.frameAt('a', 1_000_000)
    await pool.frameAt('c', 0)

    expect(pool.openCount()).toBe(2)
    // 'b' was the least recently used, so it is the one that had to go.
    expect(sinks.get('b')?.close).toHaveBeenCalled()
    expect(sinks.get('a')?.close).not.toHaveBeenCalled()
  })

  it('does not spend a decoder slot on a still picture', async () => {
    // Two rushes and a logo over them. Counting the logo against the decoders made every seek
    // evict a rush that the next seek reopened — a miss on all three, on every painted frame.
    const track = ['v1', 'v2', 'logo']
    const { open, pool } = poolOver(track, ['logo'], { maxDecoders: 2, maxPictures: 4 })

    for (const assetId of track) await pool.frameAt(assetId, 0)
    // One eviction is owed: until an opening settles, its kind is unknown and it is counted as
    // a decoder. What must not happen is that it keep happening.
    for (const assetId of track) await pool.frameAt(assetId, 40_000)
    const warm = open.mock.calls.length

    for (const assetId of track) await pool.frameAt(assetId, 80_000)
    for (const assetId of track) await pool.frameAt(assetId, 120_000)

    expect(open).toHaveBeenCalledTimes(warm)
    expect(pool.openCount()).toBe(3)
  })

  it('does not evict for a picture that is still opening', async () => {
    // The measured shape of the bug: a picture takes a fetch and a decode to arrive, and `seek`
    // is not awaited — so the frames that pass meanwhile found the pool one slot short and
    // reopened both rushes, every one of them.
    const sinks = new Map([
      ['v1', fakeSink('v1')],
      ['v2', fakeSink('v2')],
      ['logo', fakeSink('logo', false)],
    ])
    let arrive = (): void => {}
    const slow = new Promise<void>(resolve => (arrive = resolve))
    const open = vi.fn(async (assetId: string) => {
      if (assetId === 'logo') await slow
      const sink = sinks.get(assetId)
      if (!sink) throw new Error(`no sink for ${assetId}`)
      return sink
    })
    const pool = createDecoderPool({ open, maxDecoders: 2, maxPictures: 4 })

    for (const assetId of ['v1', 'v2']) await pool.frameAt(assetId, 0)
    // Four frames pass while the picture is in flight, each asking for all three.
    for (let frame = 0; frame < 4; frame += 1)
      for (const assetId of ['v1', 'v2', 'logo']) void pool.frameAt(assetId, frame * 40_000)

    arrive()
    await Promise.resolve()

    expect(open).toHaveBeenCalledTimes(3)
    expect(sinks.get('v1')?.close).not.toHaveBeenCalled()
  })

  it('never hands back a sink it has just closed', async () => {
    // The slow one is also the least recently used, so the eviction its own arrival triggers
    // would pick it — and the caller would draw a sink closed a line earlier.
    const stills = ['slow', 'p2', 'p3']
    const sinks = new Map(stills.map(id => [id, fakeSink(id, false)]))
    let arrive = (): void => {}
    const held = new Promise<void>(resolve => (arrive = resolve))
    const pool = createDecoderPool({
      open: async (assetId: string) => {
        if (assetId === 'slow') await held
        const sink = sinks.get(assetId)
        if (!sink) throw new Error(`no sink for ${assetId}`)
        return sink
      },
      maxDecoders: 2,
      maxPictures: 2,
    })

    const first = pool.frameAt('slow', 0)
    for (const assetId of ['p2', 'p3']) await pool.frameAt(assetId, 0)
    arrive()
    await first

    expect(sinks.get('slow')?.close).not.toHaveBeenCalled()
    expect(sinks.get('p2')?.close).toHaveBeenCalled()
  })

  it('does not evict an opening that has not arrived, however old its place in the order', async () => {
    // 'slow' sits at the front of the recency order and is still in flight. Dropping it there
    // costs the fetch and the decode all over again on the very next frame.
    const sinks = new Map([
      ['slow', fakeSink('slow', false)],
      ['v1', fakeSink('v1')],
      ['v2', fakeSink('v2')],
      ['v3', fakeSink('v3')],
    ])
    let arrive = (): void => {}
    const held = new Promise<void>(resolve => (arrive = resolve))
    const open = vi.fn(async (assetId: string) => {
      if (assetId === 'slow') await held
      const sink = sinks.get(assetId)
      if (!sink) throw new Error(`no sink for ${assetId}`)
      return sink
    })
    const pool = createDecoderPool({ open, maxDecoders: 2, maxPictures: 4 })

    const first = pool.frameAt('slow', 0)
    for (const assetId of ['v1', 'v2', 'v3']) await pool.frameAt(assetId, 0)

    expect(sinks.get('slow')?.close).not.toHaveBeenCalled()
    expect(sinks.get('v1')?.close).toHaveBeenCalled()

    arrive()
    await first
    expect(open).toHaveBeenCalledTimes(4)
  })

  it('evicts a decoder rather than a picture when the decoders overflow', async () => {
    // The picture is the least recently used of all, and is passed over all the same: what
    // overflowed is the decoders, and it holds none.
    const track = ['still', 'v1', 'v2', 'v3']
    const { sinks, pool } = poolOver(track, ['still'], { maxDecoders: 2, maxPictures: 4 })

    for (const assetId of track) await pool.frameAt(assetId, 0)

    expect(sinks.get('v1')?.close).toHaveBeenCalled()
    expect(sinks.get('still')?.close).not.toHaveBeenCalled()
  })

  it('evicts the least recently used picture past its own ceiling', async () => {
    const stills = ['p1', 'p2', 'p3']
    const { sinks, pool } = poolOver(stills, stills, { maxDecoders: 2, maxPictures: 2 })

    for (const assetId of stills) await pool.frameAt(assetId, 0)

    expect(sinks.get('p1')?.close).toHaveBeenCalled()
    expect(sinks.get('p3')?.close).not.toHaveBeenCalled()
    expect(pool.openCount()).toBe(2)
  })

  it('closes every sink on dispose, since a decoder outliving its engine is a leak', async () => {
    const sinks: ReturnType<typeof fakeSink>[] = []
    const open = vi.fn(async (assetId: string) => {
      const sink = fakeSink(assetId)
      sinks.push(sink)
      return sink
    })
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await pool.frameAt('a', 0)
    await pool.frameAt('b', 0)
    pool.dispose()

    // The pool holds openings, not opened sinks, so closing waits on the one microtask an
    // opening still in flight would need — see `closeLater`.
    await Promise.resolve()

    expect(sinks.every(sink => sink.close.mock.calls.length === 1)).toBe(true)
    expect(pool.openCount()).toBe(0)
  })

  it('returns null when the asset cannot be opened, rather than throwing into a paint loop', async () => {
    const pool = createDecoderPool({
      open: async () => {
        throw new Error('undecodable')
      },
      maxDecoders: 3,
      maxPictures: 2,
    })

    await expect(pool.frameAt('a', 0)).resolves.toBeNull()
  })

  it('returns null when decoding throws, rather than throwing into a paint loop', async () => {
    const pool = createDecoderPool({
      open: async () => ({
        getSample: async () => {
          throw new Error('truncated rush')
        },
        close: vi.fn(),
        holdsDecoder: true,
      }),
      maxDecoders: 3,
      maxPictures: 2,
    })

    await expect(pool.frameAt('a', 0)).resolves.toBeNull()
  })

  it('keeps decoding an asset whose sample failed once', async () => {
    const getSample = vi
      .fn<(seconds: number) => Promise<VideoSampleLike | null>>()
      .mockRejectedValueOnce(new Error('bad seek'))
      .mockResolvedValue(null)
    const open = vi.fn(async () => ({ getSample, close: vi.fn(), holdsDecoder: true }))
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await pool.frameAt('a', 0)
    await pool.frameAt('a', 40_000)

    // Unlike a failed open, one bad position does not condemn the rush for the session.
    expect(getSample).toHaveBeenCalledTimes(2)
  })

  it('does not reopen an asset that failed on every frame', async () => {
    const open = vi.fn(async () => {
      throw new Error('undecodable')
    })
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await pool.frameAt('a', 0)
    await pool.frameAt('a', 40_000)

    // Retrying a broken asset sixty times a second is how a paint loop becomes a stutter.
    expect(open).toHaveBeenCalledTimes(1)
  })

  /**
   * `frameAt` answers `null` for a gap in a rush as much as for a `.exr` Chromium will not
   * decode. Without this, the monitor cannot tell the two apart, and stays black without a word.
   */
  it('names the asset whose open failed, so the monitor can say why it shows nothing', async () => {
    const open = vi.fn(async (assetId: string) => {
      if (assetId === 'broken') throw new Error('undecodable')
      return fakeSink(assetId)
    })
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await pool.frameAt('broken', 0)
    await pool.frameAt('fine', 0)

    expect(pool.undecodable('broken')).toBe(true)
    expect(pool.undecodable('fine')).toBe(false)
    // A position with no sample is not a broken asset: nothing was ever asked of this one.
    expect(pool.undecodable('never-opened')).toBe(false)
  })

  it('stops calling an asset undecodable once it is released', async () => {
    const open = vi.fn(async () => {
      throw new Error('undecodable')
    })
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await pool.frameAt('a', 0)
    pool.release('a')

    expect(pool.undecodable('a')).toBe(false)
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
      maxPictures: 2,
    })

    await pool.frameAt('a', 0)
    await pool.frameAt('b', 0)
    pool.release('a')
    await Promise.resolve()

    expect(pool.openCount()).toBe(1)
    expect(sinks.get('a')?.close).toHaveBeenCalled()
    expect(sinks.get('b')?.close).not.toHaveBeenCalled()
  })
})

describe('two seeks racing for the same asset', () => {
  /**
   * A rush on two video tracks, or a seek a frame after the previous one: both miss while the
   * first is still opening. Awaiting before storing had each open a decoder and the second
   * overwrite the first — a hardware decoder held by nothing, on a count the OS caps low.
   */
  it('opens one decoder, not two', async () => {
    let release: (sink: ReturnType<typeof fakeSink>) => void = () => {}
    const open = vi.fn(
      () => new Promise<ReturnType<typeof fakeSink>>(resolve => (release = resolve)),
    )
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    const first = pool.frameAt('a', 0)
    const second = pool.frameAt('a', 40_000)
    release(fakeSink('a'))
    await Promise.all([first, second])

    expect(open).toHaveBeenCalledTimes(1)
    expect(pool.openCount()).toBe(1)
  })

  it('forgets an opening that failed, so the pool does not hold a rejection', async () => {
    const open = vi.fn(async () => {
      throw new Error('undecodable')
    })
    const pool = createDecoderPool({ open, maxDecoders: 3, maxPictures: 2 })

    await Promise.all([pool.frameAt('a', 0), pool.frameAt('a', 40_000)])

    expect(pool.openCount()).toBe(0)
  })
})
