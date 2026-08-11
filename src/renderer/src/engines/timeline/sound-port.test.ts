import { describe, expect, it, vi } from 'vitest'
import { createSoundPort, playFrom, type SoundOutput } from './sound-port'
import type { SoundCue } from './sound-schedule'

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
  const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
  const decoded = { length: 1 } as AudioBuffer

  const output = {
    currentTime: 12,
    state: 'running',
    resume: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async () => decoded),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    destination: { id: 'speakers' },
    // The suite drives the three calls the port makes; a real `AudioContext` offers forty more.
  } as unknown as SoundOutput

  return { output, source, gain, decoded }
}

const cue = (over: Partial<SoundCue> = {}): SoundCue => ({
  when: 20,
  offset: 1,
  duration: 3,
  rate: 1,
  gain: 0.5,
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

  it('applies the cue gain, already linear — a decibel never reaches the output', () => {
    const { output, gain } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue({ gain: 0.25 }))

    expect(gain.gain.value).toBe(0.25)
  })

  it('sends the sound through its gain to the speakers', () => {
    const { output, source, gain } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue())

    expect(source.connect).toHaveBeenCalledWith(gain)
    expect(gain.connect).toHaveBeenCalledWith(output.destination)
  })

  /**
   * A gain left connected is a node the output keeps summing — one per clip played, for as long
   * as the window lives.
   */
  it('takes the graph down once the sound has ended', () => {
    const { output, source, gain } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue())

    source.onended?.()
    expect(gain.disconnect).toHaveBeenCalled()
  })

  it('stops the source it started, and nothing else', () => {
    const { output, source } = outputWith()
    playFrom(output, {} as AudioBuffer)(cue()).stop()

    expect(source.stop).toHaveBeenCalledTimes(1)
  })
})
