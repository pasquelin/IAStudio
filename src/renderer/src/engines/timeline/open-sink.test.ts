import { describe, expect, it, vi } from 'vitest'
import { createStillSink, openSink, type SinkSources, type StillPicture } from './open-sink'
import type { SinkLike } from './decoder-pool'

const picture = (): StillPicture & { frame: ReturnType<typeof vi.fn> } => {
  let drawn = 0
  return {
    frame: vi.fn(() => `frame ${(drawn += 1)}` as unknown as VideoFrame),
    close: vi.fn(),
  }
}

const videoSink = (): SinkLike => ({
  getSample: vi.fn(async () => null),
  close: vi.fn(),
})

const sources = (over: Partial<SinkSources> = {}): SinkSources => ({
  read: vi.fn(async () => new Blob()),
  openVideo: vi.fn(async () => null),
  openPicture: vi.fn(async () => picture()),
  ...over,
})

describe('still sink', () => {
  it('answers the same picture at every position', async () => {
    const still = picture()
    const sink = createStillSink(still)

    const first = await sink.getSample(0)
    const later = await sink.getSample(42)

    expect(first?.toVideoFrame()).toBe('frame 1')
    expect(later?.toVideoFrame()).toBe('frame 2')
    expect(still.frame).toHaveBeenCalledTimes(2)
  })

  it('keeps the picture open when a sample closes, and lets it go when the sink does', async () => {
    const still = picture()
    const sink = createStillSink(still)

    const sample = await sink.getSample(0)
    sample?.close()
    expect(still.close).not.toHaveBeenCalled()

    sink.close()
    expect(still.close).toHaveBeenCalledTimes(1)
  })
})

describe('opening a sink', () => {
  it('takes the video track when the asset carries one', async () => {
    const video = videoSink()
    const deps = sources({ openVideo: vi.fn(async () => video) })

    expect(await openSink('a', deps)).toBe(video)
    expect(deps.openPicture).not.toHaveBeenCalled()
  })

  it('falls back to the picture when the asset carries no video track', async () => {
    const still = picture()
    const deps = sources({ openPicture: vi.fn(async () => still) })

    const sink = await openSink('a', deps)
    const sample = await sink.getSample(0)

    expect(sample?.toVideoFrame()).toBe('frame 1')
  })

  it('reads the bytes once, and hands the same ones to both attempts', async () => {
    const bytes = new Blob()
    const deps = sources({ read: vi.fn(async () => bytes) })

    await openSink('a', deps)

    expect(deps.read).toHaveBeenCalledTimes(1)
    expect(deps.openVideo).toHaveBeenCalledWith(bytes)
    expect(deps.openPicture).toHaveBeenCalledWith(bytes)
  })

  it('fails for bytes that are neither a video nor a picture', async () => {
    const deps = sources({
      openPicture: vi.fn(() => Promise.reject(new Error('not an image'))),
    })

    await expect(openSink('a', deps)).rejects.toThrow('not an image')
  })
})
