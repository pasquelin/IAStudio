import { describe, expect, it, vi } from 'vitest'
import { clipAt, createFrameSink, sourceTimeAt, videoTracksByDepth } from './TimelineEngine'
import { EMPTY_SEQUENCE, type Clip, type SequenceState } from './timeline-state'

const clip = (id: string, start: number, duration: number, inPoint = 0): Clip => ({
  id,
  assetId: `asset-${id}`,
  start,
  duration,
  inPoint,
  speed: 1,
})

const stateWith = (clips: Clip[]): SequenceState => ({
  ...EMPTY_SEQUENCE,
  tracks: [{ id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips }],
})

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
    const state: SequenceState = {
      ...EMPTY_SEQUENCE,
      tracks: [
        { id: 'V2', kind: 'video', index: 2, muted: false, locked: false, clips: [] },
        { id: 'A1', kind: 'audio', index: 0, muted: false, locked: false, clips: [] },
        { id: 'V1', kind: 'video', index: 1, muted: false, locked: false, clips: [] },
      ],
    }
    expect(videoTracksByDepth(state).map(track => track.id)).toEqual(['V1', 'V2'])
  })

  it('closes every frame it uploads', () => {
    const close = vi.fn()
    createFrameSink({ upload: vi.fn() }).push(frame(close))
    // A frame kept past its upload leaks GPU memory, and it shows in seconds, not minutes.
    expect(close).toHaveBeenCalledTimes(1)
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
