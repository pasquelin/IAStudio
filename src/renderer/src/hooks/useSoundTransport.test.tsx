import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SECOND } from '@shared/domain/time'
import type { TimelineEngineDeps } from '@/engines/timeline/TimelineEngine'
import { EMPTY_SOUND_SEQUENCE, type Us } from '@/engines/timeline/timelineState'
import { usePlayback } from '@/stores/playback'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSoundTransport } from './useSoundTransport'

// jsdom has neither an output device nor WebGL: the engine hands its deps back and the clock is
// turned by hand. What this covers is what a played montage costs the store that holds it.
const built: TimelineEngineDeps[] = []
/** What the engine is taught, which the tab pushes in on every new montage reference. */
const applied = vi.fn()

vi.mock('@/engines/timeline/TimelineEngine', () => ({
  TimelineEngine: class {
    constructor(deps: TimelineEngineDeps) {
      built.push(deps)
    }
    apply = applied
    play = vi.fn()
    pause = vi.fn()
    playing = vi.fn(() => true)
    dispose = vi.fn()
  },
}))

const DOCUMENT = 'doc-1'
/** Five seconds of montage, at the rate `TimelineEngine.step` reports at. */
const TICKS = 300
const FRAME: Us = SECOND / 60

beforeEach(() => {
  built.length = 0
  applied.mockClear()
  useSequences.setState({ states: { [DOCUMENT]: EMPTY_SOUND_SEQUENCE }, histories: {} })
  usePlayback.setState({ running: {}, heads: {} })
})

/**
 * The tab, as `AudioDocument` mounts it: the montage read from the store and handed to the hook,
 * so what a tick costs the store comes back around as a render and a fresh `apply`.
 */
function playFiveSeconds(): { writes: number; wakes: number; applies: number } {
  let writes = 0
  const stop = useSequences.subscribe((state, previous) => {
    if (sequenceOf(state, DOCUMENT) !== sequenceOf(previous, DOCUMENT)) writes += 1
  })

  let wakes = 0
  renderHook(() => {
    wakes += 1
    return useSoundTransport(
      DOCUMENT,
      useSequences(state => sequenceOf(state, DOCUMENT)),
    )
  })
  const mounted = applied.mock.calls.length

  const onTime = built.at(-1)?.onTime
  act(() => built.at(-1)?.onPlayingChange?.(true))
  // One `act` per tick rather than one for the batch: a batch is a single commit, and it would
  // hide three hundred wake-ups behind one.
  for (let tick = 0; tick < TICKS; tick += 1) act(() => onTime?.(tick * FRAME))
  stop()

  return { writes, wakes: wakes - 1, applies: applied.mock.calls.length - mounted }
}

describe('what playing a sound montage costs the document', () => {
  /**
   * The head belongs to the clock while it runs, exactly as the picture pair has it: replacing
   * the montage sixty times a second woke the strip, the monitor and the take editor for a
   * number they can read from the transport instead.
   */
  it('writes the montage not once over five seconds of playback', () => {
    // The one wake is the transport starting, which is what the play button is for.
    expect(playFiveSeconds()).toEqual({ writes: 0, wakes: 1, applies: 0 })
  })

  it('publishes the head it no longer writes', () => {
    playFiveSeconds()

    expect(usePlayback.getState().heads[DOCUMENT]).toBe((TICKS - 1) * FRAME)
  })

  /**
   * `pause` reports one last time, and the engine says it has stopped first so that this write
   * lands: without it the montage keeps the head it had before playing, and the next play, split
   * or export acts a whole take too early.
   */
  it('hands the head back to the montage when the transport stops', () => {
    playFiveSeconds()

    act(() => built.at(-1)?.onPlayingChange?.(false))
    act(() => built.at(-1)?.onTime?.(5 * SECOND))

    expect(sequenceOf(useSequences.getState(), DOCUMENT).playhead).toBe(5 * SECOND)
    // And publishes none of its own: every surface reads `clockHead ?? sequence.playhead`, so a
    // head left behind by a finished run would hide every later scrub of this document.
    expect(usePlayback.getState().heads[DOCUMENT]).toBeUndefined()
  })

  /** Stopped, the head is the document's again — a scrub is an edit of where one is looking. */
  it('writes the head into the montage while nothing plays', () => {
    renderHook(() => useSoundTransport(DOCUMENT, EMPTY_SOUND_SEQUENCE))

    act(() => built.at(-1)?.onTime?.(2 * SECOND))

    expect(sequenceOf(useSequences.getState(), DOCUMENT).playhead).toBe(2 * SECOND)
  })
})
