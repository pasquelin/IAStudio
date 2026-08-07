import { Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import {
  clipAt,
  createFrameSink,
  fitInside,
  swapTexture,
  uploadNow,
  videoTracksByDepth,
} from './TimelineEngine'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import type { Clip, SequenceState } from './timeline-state'

const clip = (id: string, start: number, duration: number, inPoint = 0): Clip =>
  clipFixture(id, start, duration, { inPoint })

const stateWith = (clips: Clip[]): SequenceState =>
  sequenceWith([trackFixture('V1', 'video', clips)])

const frame = (close: () => void): VideoFrame =>
  // jsdom has no VideoFrame; the engine only ever calls `close` on it.
  ({ close }) as unknown as VideoFrame

describe('timeline engine', () => {
  it('finds the clip playing on a track at a given time', () => {
    const track = stateWith([clip('a', 0, 1_000_000), clip('b', 2_000_000, 1_000_000)]).tracks[0]!
    expect(clipAt(track, 500_000)?.id).toBe('a')
    expect(clipAt(track, 1_500_000)).toBeNull()
    expect(clipAt(track, 2_000_000)?.id).toBe('b')
  })

  it('treats the end of a clip as outside it, so a butt joint plays the next one', () => {
    const track = stateWith([clip('a', 0, 1_000_000)]).tracks[0]!
    expect(clipAt(track, 1_000_000)).toBeNull()
  })

  it('orders video tracks by index, so the highest one is composited last', () => {
    const state = sequenceWith([
      trackFixture('V2', 'video', [], { index: 2 }),
      trackFixture('A1', 'audio'),
      trackFixture('V1', 'video'),
    ])
    expect(videoTracksByDepth(state).map(track => track.id)).toEqual(['V1', 'V2'])
  })

  it('centres a wider picture between horizontal bars', () => {
    // 800×400 into 400×400: scaled by half, and the 200 leftover pixels split above and below.
    expect(fitInside({ width: 800, height: 400 }, { width: 400, height: 400 })).toEqual({
      x: 0,
      y: 100,
      scale: 0.5,
    })
  })

  it('centres a taller picture between vertical bars', () => {
    expect(fitInside({ width: 400, height: 800 }, { width: 400, height: 400 })).toEqual({
      x: 100,
      y: 0,
      scale: 0.5,
    })
  })

  it('enlarges a picture smaller than the frame rather than pinning it to a corner', () => {
    expect(fitInside({ width: 100, height: 100 }, { width: 400, height: 200 })).toEqual({
      x: 100,
      y: 0,
      scale: 2,
    })
  })

  // A monitor is laid out before it is measured, and a texture is sized before it is decoded.
  it('answers something finite when either side has no size yet', () => {
    expect(fitInside({ width: 0, height: 0 }, { width: 400, height: 400 })).toEqual({
      x: 0,
      y: 0,
      scale: 0,
    })
    expect(fitInside({ width: 800, height: 400 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      scale: 0,
    })
  })

  // Left to Pixi, the upload happens at the next render — long after the sink closed the frame
  // behind it, and the monitor then paints nothing at all, for every media.
  it('puts a texture on the GPU rather than waiting for the next render', () => {
    const initSource = vi.fn()
    const texture = new Texture()

    expect(uploadNow(texture, { initSource })).toBe(texture)
    expect(initSource).toHaveBeenCalledWith(texture.source)
  })

  it('closes every frame it uploads', () => {
    const close = vi.fn()
    createFrameSink({ upload: vi.fn() }).push(frame(close))
    // A frame kept past its upload leaks GPU memory, and it shows in seconds, not minutes.
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('destroys the texture it replaces, which held a frame nobody will show again', () => {
    const previous = new Texture()
    const destroy = vi.spyOn(previous, 'destroy')
    const target = { texture: previous }

    swapTexture(target, Texture.EMPTY)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('leaves the empty texture alone, which every sprite in the application starts on', () => {
    const destroy = vi.spyOn(Texture.EMPTY, 'destroy')
    const target = { texture: Texture.EMPTY }

    swapTexture(target, new Texture())
    expect(destroy).not.toHaveBeenCalled()
    destroy.mockRestore()
  })

  it('still closes the frame when the upload throws', () => {
    const close = vi.fn()
    const sink = createFrameSink({
      upload: () => {
        throw new Error('context lost')
      },
    })

    expect(() => sink.push(frame(close))).toThrow()
    expect(close).toHaveBeenCalledTimes(1)
  })
})
