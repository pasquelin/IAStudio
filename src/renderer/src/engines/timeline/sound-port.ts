import { fetchAsset } from '@/helpers/asset-fetch'
import type { LoadedSound, SoundCue, SoundPort } from './sound-schedule'

/** What the port needs of an output, which is far less than an `AudioContext` offers. */
export type SoundOutput = Pick<
  AudioContext,
  | 'currentTime'
  | 'state'
  | 'resume'
  | 'decodeAudioData'
  | 'createBufferSource'
  | 'createGain'
  | 'destination'
>

/**
 * One source per slice, through a gain of its own.
 *
 * The node graph is torn down when the sound ends: a gain left connected is a node the output
 * keeps summing, one per clip played, for as long as the window lives.
 */
export function playFrom(output: SoundOutput, buffer: AudioBuffer): LoadedSound {
  return (cue: SoundCue) => {
    const source = output.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = cue.rate

    const gain = output.createGain()
    // Anchored at `when`, never assigned: a ramp with no point before it starts from the instant
    // the graph was built, so a fade laid a second ahead would already be half over when it began.
    gain.gain.setValueAtTime(cue.gain, cue.when)
    for (const ramp of cue.ramps) gain.gain.linearRampToValueAtTime(ramp.level, ramp.at)

    source.connect(gain).connect(output.destination)
    source.onended = () => gain.disconnect()

    source.start(cue.when, cue.offset, cue.duration)
    // Ending a source fires `onended` too, so the graph comes down either way.
    return { stop: () => source.stop() }
  }
}

/**
 * The one output of the window, built on first use.
 *
 * Shared rather than one per monitor: a browser caps a page at a handful of audio contexts, and
 * a workspace mounts two monitors per tab. Never closed — an idle context holds a suspended
 * output device, where closing it would leave a reopened tab unable to make a sound.
 */
let shared: AudioContext | null = null

function sharedOutput(): AudioContext {
  shared ??= new AudioContext()
  return shared
}

/**
 * The browser behind the port: the bytes over the scheme, its own decoder, its own clock.
 *
 * The output is asked for on the first sound and not before. A monitor is mounted long before
 * anyone presses play — often never — and building it at mount opened an output device for a
 * silent tab, where jsdom has none to open at all.
 */
export function createSoundPort(output: () => SoundOutput = sharedOutput): SoundPort {
  /** Set by the two calls that legitimately want an output. Asking the time never does. */
  let opened = false

  /** Never the reason to build one: asking the time is what the engine's clock does per frame. */
  const clock = (): number | null => {
    if (!opened) return null
    const running = output()
    // A suspended output freezes `currentTime`, and both the schedule and the engine's clock
    // read this: handing back a frozen instant would stop the sequence rather than let it run.
    return running.state === 'running' ? running.currentTime : null
  }

  return {
    now: clock,
    resume: () => {
      opened = true
      void output().resume()
    },
    load: async assetId => {
      opened = true
      const bytes = await (await fetchAsset(assetId)).arrayBuffer()
      return playFrom(output(), await output().decodeAudioData(bytes))
    },
  }
}
