import { CLIP_DB, FLOOR_DB } from '@/engines/audio/level'
import { fetchAsset } from '@/helpers/asset-fetch'
import type { AudioTap, LoadedSound, SoundCue, SoundPort } from './sound-schedule'

/** What the port needs of an output, which is far less than an `AudioContext` offers. */
export type SoundOutput = Pick<
  AudioContext,
  | 'currentTime'
  | 'state'
  | 'resume'
  | 'sampleRate'
  | 'decodeAudioData'
  | 'createAnalyser'
  | 'createBufferSource'
  | 'createGain'
  | 'destination'
>

/**
 * How many samples the analyser reads at once. 2048 gives 1024 bins, which is a spectrum fine
 * enough to tell a bass note from the one above it and still one frame's work to walk.
 */
const FFT_SIZE = 2048

/**
 * Everything the window plays passes through here on its way out, so a meter has one place to
 * listen — where each clip used to reach `destination` on its own and nothing stood in between.
 *
 * Kept beside the output that built it rather than per port: two Audio tabs share one context,
 * and a bus per tab would leave one summing node behind per tab ever opened. Sharing it is also
 * what the meter means — the OUTPUT's level, and the playback token already grants one player.
 */
type SoundBus = { input: AudioNode; tap: AudioTap }

/**
 * One bus per output, held weakly. A single slot would do for the studio as it stands — one
 * context per window — but two outputs alternating would rebuild an analyser and a gain per cue
 * and leave every previous one connected to `destination`, which is the very leak this bus was
 * written to avoid.
 */
const buses = new WeakMap<SoundOutput, SoundBus>()

function busFor(output: SoundOutput): SoundBus {
  const known = buses.get(output)
  if (known) return known

  const analyser = output.createAnalyser()
  analyser.fftSize = FFT_SIZE
  // The studio's own scale rather than the browser's −100/−30 default, and this is what lets a
  // spectrum bin be READ: a byte then lands where the meter's bar would, so the same two
  // thresholds colour both. Left at the default, no bin could ever reach −6 dB — the range stops
  // at −30 — and every bar would have been coloured by a number that meant nothing.
  analyser.minDecibels = FLOOR_DB
  analyser.maxDecibels = CLIP_DB
  const input = output.createGain()
  input.connect(analyser).connect(output.destination)

  // Filled in place on every read: at sixty frames a second, two arrays per frame is two
  // thousand allocations a minute for a bar and a row of bins.
  const samples = new Float32Array(analyser.fftSize)
  const bins = new Uint8Array(analyser.frequencyBinCount)

  const bus: SoundBus = {
    input,
    tap: {
      sampleRate: output.sampleRate,
      levels: () => {
        analyser.getFloatTimeDomainData(samples)
        return samples
      },
      frequencies: () => {
        analyser.getByteFrequencyData(bins)
        return bins
      },
    },
  }

  buses.set(output, bus)
  return bus
}

/**
 * One source per slice, through a gain of its own, onto the window's one bus.
 *
 * The node graph is torn down when the sound ends: a gain left connected is a node the output
 * keeps summing, one per clip played, for as long as the window lives. The bus itself is not
 * part of that teardown — it outlives every clip, which is the point of it.
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
    for (const ramp of cue.ramps) gain.gain.linearRampToValueAtTime(ramp.level, ramp.when)

    source.connect(gain).connect(busFor(output).input)
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
    // Null until something has been played: a tab mounts its monitor long before anyone presses
    // play, and asking for a tap is not a reason to open an output device.
    tap: () => (opened ? busFor(output()).tap : null),
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
