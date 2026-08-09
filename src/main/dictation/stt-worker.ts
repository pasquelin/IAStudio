// The default export, never named ones: the package is CommonJS and builds its exports from
// property accesses, which Node cannot see through — `import { Vad }` compiles and then throws
// on the first run. See `shared/types/sherpa-onnx-node.d.ts`.
import sherpa, { type OfflineRecognizer, type Vad } from 'sherpa-onnx-node'
import { STT_SAMPLE_RATE, toFloat } from '@shared/domain/dictation'
import { emptyHeld, hold, previewOf, type Held } from './segmenter'
import { createSerial } from './serial'
import { isAudio, isLoad, type SttLoad, type SttMessage, type SttResponse } from './stt-protocol'

/**
 * The recognition engine, in a process of its own.
 *
 * It runs here and nowhere else. Parakeet is 600 million parameters: on the main process it
 * would freeze every window at once, and in the renderer it would freeze the window it was
 * typed into. `decodeAsync` keeps even this process answering while it works, so audio arriving
 * during an inference is received rather than lost — and then queued, never handled at once
 * (see the message loop at the bottom).
 *
 * Never throws. A failure travels back as a message, because a message loop that dies leaves
 * the main process holding a promise nobody settles.
 */

/** Silero reads 512 samples at a time at 16 kHz; anything else costs it accuracy. */
const VAD_WINDOW = 512

/** How much audio the detector may hold, in seconds. Well past the longest sentence. */
const VAD_BUFFER_SECONDS = 60

type Engine = {
  vad: Vad
  recognizer: OfflineRecognizer
  previewMs: number
}

let engine: Engine | null = null
let held: Held = emptyHeld()
/** Samples fed since the detector last said someone started speaking. */
let spoken = 0
let previewAt = 0
let lastDropped = 0

const reply = (response: SttResponse): void => {
  process.parentPort.postMessage(response)
}

async function load(request: SttLoad): Promise<void> {
  const vad = new sherpa.Vad(
    {
      sileroVad: {
        model: request.vad,
        // Seconds here, milliseconds in the setting: the boundary between the two is this line.
        minSilenceDuration: request.silenceMs / 1000,
        // Shorter than this is a cough, a click, or a chair — never a sentence.
        minSpeechDuration: 0.25,
        windowSize: VAD_WINDOW,
      },
      sampleRate: STT_SAMPLE_RATE,
      numThreads: 1,
    },
    VAD_BUFFER_SECONDS,
  )

  // Off this thread: reading 640 MB of weights would otherwise hold every message sent while
  // it runs, and the first of them is the audio the user is already speaking.
  const recognizer = await sherpa.OfflineRecognizer.createAsync({
    featConfig: { sampleRate: STT_SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: request.encoder,
        decoder: request.decoder,
        joiner: request.joiner,
      },
      tokens: request.tokens,
      // Guessed from the files when absent, and guessed wrong for Parakeet.
      modelType: 'nemo_transducer',
      numThreads: request.threads,
    },
  })

  engine = { vad, recognizer, previewMs: request.previewMs }
}

async function decode(current: Engine, samples: Float32Array): Promise<string> {
  const stream = current.recognizer.createStream()
  stream.acceptWaveform({ samples, sampleRate: STT_SAMPLE_RATE })
  const result = await current.recognizer.decodeAsync(stream)

  return result.text.trim()
}

/**
 * Whatever the detector has closed, decoded and settled, oldest first.
 *
 * The audio comes from what this worker held, not from `front().samples`: the detector needs a
 * few frames to be sure someone started, and it trims them off the segment it hands over. Fed
 * its own segment, "Un petit phare" came back as "Petit phare" — the first word, every time.
 * `previewOf` reaches back before the detection, which is exactly what was missing.
 *
 * Several segments waiting at once is the exception — a machine so far behind that a second
 * sentence closed while the first was decoding — and there the held buffer no longer maps to
 * one of them. Those fall back to the detector's own audio: a slightly clipped opening beats a
 * sentence dropped.
 */
async function drainSegments(current: Engine): Promise<void> {
  let alone = true

  while (!current.vad.isEmpty()) {
    const ours = alone && held.length > 0
    // Read only on the branch that uses it: `front(false)` exists to COPY the addon's buffer —
    // 640 KB for a ten-second sentence — and the ordinary branch would throw that copy away.
    //
    // `false` because Electron refuses an external buffer, which is what the default wraps:
    // "External buffers are not allowed", where plain Node accepts it.
    const samples = ours ? previewOf(held, spoken) : current.vad.front(false).samples
    current.vad.pop()
    alone = false

    const startedAt = Date.now()
    const text = await decode(current, samples)

    // Silence long enough to close a segment still decodes to nothing sometimes; an empty final
    // would clear the preview on screen and put nothing in its place.
    if (text) reply({ final: text, latencyMs: Date.now() - startedAt })

    // Cleared as soon as the sentence it belonged to is settled: holding it would have the next
    // preview read a sentence already on screen.
    held = emptyHeld()
    spoken = 0
  }
}

/**
 * Decodes the sentence in flight, if enough time has passed since the last one.
 *
 * The model is not a streaming one: a preview is a full decode of everything said since the
 * sentence began, which is why it is paced. On a machine that cannot keep up, previews thin out
 * on their own and the settled text is unaffected.
 */
async function preview(current: Engine, now: number): Promise<void> {
  if (current.previewMs === 0 || now - previewAt < current.previewMs) return

  // Stamped before the decode, not after: what paces previews is when one started, so a slow
  // machine spaces them out on its own instead of running them back to back to catch up.
  previewAt = now
  const text = await decode(current, previewOf(held, spoken))
  if (text) reply({ partial: text })
}

async function accept(current: Engine, samples: Int16Array): Promise<void> {
  const chunk = toFloat(samples)
  current.vad.acceptWaveform(chunk)

  // Held whether or not anyone is speaking, because the moment speech is recognised is already
  // past the moment it began — what came just before is what makes a first word survive.
  held = hold(held, chunk)
  if (current.vad.isDetected()) spoken += chunk.length

  if (held.dropped > lastDropped) {
    reply({ dropped: held.dropped - lastDropped })
    lastDropped = held.dropped
  }

  await drainSegments(current)
  // After draining: a segment that just closed makes the preview pointless, and its `final` is
  // already on its way.
  if (spoken > 0) await preview(current, Date.now())
}

/** Drops the engine and everything that belonged to the session it was serving. */
function forget(): void {
  engine = null
  held = emptyHeld()
  spoken = 0
  previewAt = 0
  lastDropped = 0
}

async function handle(message: SttMessage): Promise<void> {
  if (isLoad(message)) {
    await load(message)
    reply({ ready: true })
    return
  }

  const current = engine
  // Audio before the engine exists is not a failure worth reporting: the session is being set
  // up, and the capture starts the moment the user presses the key.
  if (!current) return

  if (isAudio(message)) {
    await accept(current, message.audio)
    return
  }

  if ('flush' in message) {
    // Closes the speech in flight so the last words become a segment: without it, letting go of
    // the key would drop whatever was said since the last silence.
    current.vad.flush()
    await drainSegments(current)
    return
  }

  current.vad.clear()
  current.vad.reset()
  held = emptyHeld()
  spoken = 0
}

/**
 * One message at a time — see `serial.ts` for what happens without it.
 *
 * A chunk arriving while a decode runs costs almost nothing when its turn comes: it is fed to
 * the detector and held, and the preview that would have cost something is passed over by its
 * own pacing.
 */
let handling: SttMessage | null = null

const serial = createSerial((error: unknown) => {
  const reason = error instanceof Error ? error.message : String(error)

  // A load that failed answers the handshake; anything later is a session that has broken.
  if (handling && isLoad(handling)) reply({ ready: false, error: reason })
  else reply({ failed: reason })

  forget()
})

process.parentPort.on('message', event => {
  const message: SttMessage = event.data

  void serial.run(() => {
    handling = message
    return handle(message)
  })
})
