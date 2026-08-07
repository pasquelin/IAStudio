import { Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import {
  clipAt,
  createFrameSink,
  sourceTimeAt,
  swapTexture,
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

  it('maps a timeline time to a source time through the in point', () => {
    expect(sourceTimeAt(clip('a', 1_000_000, 1_000_000, 5_000_000), 1_400_000)).toBe(5_400_000)
  })

  it('accounts for speed when mapping to the source', () => {
    expect(sourceTimeAt({ ...clip('a', 0, 1_000_000), speed: 2 }, 500_000)).toBe(1_000_000)
  })

  it('orders video tracks by index, so the highest one is composited last', () => {
    const state = sequenceWith([
      trackFixture('V2', 'video', [], { index: 2 }),
      trackFixture('A1', 'audio'),
      trackFixture('V1', 'video'),
    ])
    expect(videoTracksByDepth(state).map(track => track.id)).toEqual(['V1', 'V2'])
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
