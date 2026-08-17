import { describe, expect, it, vi } from 'vitest'
import { CLIP_DB, FLOOR_DB } from '@/engines/audio/level'
import { createSoundPort, playFrom, type SoundOutput } from './soundPort'
import type { SoundCue } from './soundSchedule'

const fetchAsset = vi.hoisted(() => vi.fn(async () => new Response(new ArrayBuffer(8))))
vi.mock('@/helpers/asset-fetch', () => ({ fetchAsset }))

/** A node graph the suite can read back: jsdom has no Web Audio at all. */
const outputWith = () => {
  const source = {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    connect: vi.fn(<T>(node: T): T => node),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }
  // One object per call, so the clip's gain and the bus's can be told apart — they are the same
  // kind of node standing at two ends of the graph.
  const gains: ReturnType<typeof makeGain>[] = []
  const makeGain = () => ({
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(<T>(node: T): T => node),
    disconnect: vi.fn(),
  })
  const analyser = {
    fftSize: 0,
    minDecibels: -100,
    maxDecibels: -30,
    frequencyBinCount: 4,
    connect: vi.fn(<T>(node: T): T => node),
    getFloatTimeDomainData: vi.fn(),
    getByteFrequencyData: vi.fn(),
  }
  const decoded = { length: 1 } as AudioBuffer

  const output = {
    currentTime: 12,
    state: 'running',
    sampleRate: 48_000,
    resume: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async () => decoded),
    createAnalyser: vi.fn(() => analyser),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => {
      const made = makeGain()
      gains.push(made)
      return made
    }),
    destination: { id: 'speakers' },
    // The suite drives the calls the port makes; a real `AudioContext` offers forty more.
  } as unknown as SoundOutput

  // The clip's own gain is made first: `playFrom` builds it before reaching for the bus.
  return { output, source, gains, analyser, decoded, gain: () => gains[0] }
}

const cue = (over: Partial<SoundCue> = {}): SoundCue => ({
  when: 20,
  offset: 1,
  duration: 3,
  rate: 1,
  gain: 0.5,
  ramps: [],
  ...over,
})

describe('the browser sound port', () => {
  it('reads the output clock, which is what the schedule anchors on', () => {
    const { output } = outputWith()
    const port = createSoundPort(() => output)
    port.resume()

    expect(port.now()).toBe(12)
  })

  /**
   * The engine's clock reads this on every frame, and it must never be the reason an output
   * device is opened — a sequence with no sound would hold one for the life of the window.
   */
  it('answers no time at all before anything was played', () => {
    const { output } = outputWith()
    const open = vi.fn(() => output)

    expect(createSoundPort(open).now()).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  /**
   * A suspended output freezes `currentTime`. Handed back as a time, it pegs the sequence to an
   * instant that never moves — the playhead stops rather than the sound starting.
   */
  it('answers no time while the output is suspended', () => {
    const { output } = outputWith()
    const port = createSoundPort(() => ({ ...output, state: 'suspended' }))
    port.resume()

    expect(port.now()).toBeNull()
  })

  // Built before any gesture, an output starts suspended and every cue lands in silence.
  it('wakes the output when asked to resume', () => {
    const { output } = outputWith()
    createSoundPort(() => output).resume()

    expect(output.resume).toHaveBeenCalled()
  })

  it('decodes the asset bytes and hands back something that plays them', async () => {
    const { output, source, decoded } = outputWith()
    const sound = await createSoundPort(() => output).load('asset-a')
    sound(cue())

    expect(fetchAsset).toHaveBeenCalledWith('asset-a')
    expect(source.buffer).toBe(decoded)
  })

  it('starts the source at the cue, from its offset and for its length', () => {
    const { output, source } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue({ when: 20, offset: 1, duration: 3 }))

    expect(source.start).toHaveBeenCalledWith(20, 1, 3)
  })

  it('reads the source at the cue rate, so a sped-up clip stays in sync', () => {
    const { output, source } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue({ rate: 2 }))

    expect(source.playbackRate.value).toBe(2)
  })

  /**
   * Anchored at `when` rather than assigned: a ramp with no point before it starts from the
   * instant the graph was built, and a fade planned a second ahead would be half over at its own
   * start.
   */
  it('applies the cue gain at the cue instant, already linear — no decibel reaches the output', () => {
    const { output, gain } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue({ when: 20, gain: 0.25 }))

    expect(gain()?.gain.setValueAtTime).toHaveBeenCalledWith(0.25, 20)
  })

  it('lays the envelope out as ramps, each landing at its own instant', () => {
    const { output, gain } = outputWith()
    const envelope = [
      { when: 21, level: 1 },
      { when: 23, level: 0 },
    ]
    playFrom(output, {} as AudioBuffer)(cue({ ramps: envelope }))

    expect(gain()?.gain.linearRampToValueAtTime.mock.calls).toEqual([
      [1, 21],
      [0, 23],
    ])
  })

  it('asks for no ramp at all when the slice holds one level', () => {
    const { output, gain } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue())

    expect(gain()?.gain.linearRampToValueAtTime).not.toHaveBeenCalled()
  })

  /**
   * Every clip meets on one bus on its way out, which is what gives a meter somewhere to listen:
   * each of them used to reach `destination` on its own, with nothing in between to read.
   */
  it('sends the sound through its gain onto the bus, and the bus to the speakers', () => {
    const { output, source, gains, analyser } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue())

    const [clip, busInput] = gains
    expect(source.connect).toHaveBeenCalledWith(clip)
    expect(clip?.connect).toHaveBeenCalledWith(busInput)
    expect(busInput?.connect).toHaveBeenCalledWith(analyser)
    expect(analyser.connect).toHaveBeenCalledWith(output.destination)
  })

  it('builds that bus once, however many sounds pass through it', () => {
    const { output, analyser } = outputWith()
    const play = playFrom(output, {} as AudioBuffer)
    play(cue())
    play(cue({ when: 30 }))

    expect(output.createAnalyser).toHaveBeenCalledTimes(1)
    expect(analyser.fftSize).toBe(2048)
  })

  /**
   * The browser's own range stops at −30 dB. Left there, no spectrum bin could ever stand within
   * six decibels of full scale, and every bar would have been coloured by a number meaning
   * nothing — which is exactly what happened before this was set.
   */
  it('spreads the analyser over the studio scale rather than the browser default', () => {
    const { output, analyser } = outputWith()
    const port = createSoundPort(() => output)
    port.resume()
    port.tap()

    expect(analyser.minDecibels).toBe(FLOOR_DB)
    expect(analyser.maxDecibels).toBe(CLIP_DB)
  })

  /**
   * A gain left connected is a node the output keeps summing — one per clip played, for as long
   * as the window lives. The bus is the exception it must not take with it: torn down with the
   * first clip that ends, every sound after it would be inaudible.
   */
  it('takes the clip down once the sound has ended, and leaves the bus standing', () => {
    const { output, source, gains } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue())

    source.onended?.()
    const [clip, busInput] = gains
    expect(clip?.disconnect).toHaveBeenCalled()
    expect(busInput?.disconnect).not.toHaveBeenCalled()
  })

  it('stops the source it started, and nothing else', () => {
    const { output, source } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue()).stop()

    expect(source.stop).toHaveBeenCalledTimes(1)
  })
})

describe('listening to what goes out', () => {
  /** Same reason as the clock: a monitor is mounted long before anyone presses play. */
  it('offers nothing to listen to before an output was opened', () => {
    const { output } = outputWith()
    const open = vi.fn(() => output)

    expect(createSoundPort(open).tap()).toBeNull()
    expect(open).not.toHaveBeenCalled()
  })

  it('listens on the same bus the sounds are summed onto, at the output rate', () => {
    const { output } = outputWith()
    const port = createSoundPort(() => output)
    port.resume()

    expect(port.tap()?.sampleRate).toBe(48_000)
    expect(output.createAnalyser).toHaveBeenCalledTimes(1)
  })

  /**
   * Both readers hand back a buffer of their own, refilled in place: at sixty frames a second, a
   * pair of fresh arrays per frame is two thousand allocations a minute for one bar and a row of
   * bins.
   */
  it('refills the buffers it owns rather than handing out new ones', () => {
    const { output, analyser } = outputWith()
    const port = createSoundPort(() => output)
    port.resume()
    const tap = port.tap()

    expect(tap?.levels()).toBe(tap?.levels())
    expect(tap?.frequencies()).toBe(tap?.frequencies())
    expect(analyser.getFloatTimeDomainData).toHaveBeenCalledTimes(2)
    expect(tap?.frequencies()).toHaveLength(analyser.frequencyBinCount)
  })
})
