/**
 * Offline dictation: what the renderer, the main process and the recognition worker all have to
 * agree on. The engine itself runs in a `utilityProcess` and never appears here.
 */

/**
 * Where a dictation session stands. Flat strings rather than a discriminated union: what a
 * download or a failure carries travels in `SttSnapshot` beside it, so that a window opened
 * mid-download learns both in one read rather than waiting for the next event.
 */
export type SttState =
  | 'idle'
  /** The microphone was refused, or never asked for. The interface leads to the system settings. */
  | 'permissionRequired'
  /** The engine is here, the model is not. Nothing is fetched until someone asks. */
  | 'modelMissing'
  | 'downloadingModel'
  /** The model is on disk and being read into memory — around 700 MB, so it is worth showing. */
  | 'loadingEngine'
  | 'ready'
  | 'listening'
  | 'error'

export const STT_STATES: readonly SttState[] = [
  'idle',
  'permissionRequired',
  'modelMissing',
  'downloadingModel',
  'loadingEngine',
  'ready',
  'listening',
  'error',
]

export type SttErrorCode =
  | 'permissionDenied'
  | 'noInputDevice'
  | 'modelDownloadFailed'
  | 'modelChecksumMismatch'
  | 'engineCrashed'
  | 'unsupportedPlatform'

export const STT_ERROR_CODES: readonly SttErrorCode[] = [
  'permissionDenied',
  'noInputDevice',
  'modelDownloadFailed',
  'modelChecksumMismatch',
  'engineCrashed',
  'unsupportedPlatform',
]

/**
 * A refusal, in two parts: the code the interface translates, and the detail it logs. The
 * message is never shown on its own — it names a file path or an ONNX symbol.
 */
export type SttFailure = { code: SttErrorCode; message: string }

/** Bytes across the whole model, not within the file being fetched. */
export type DownloadProgress = { received: number; total: number }

export type SttEvent =
  | { type: 'state'; state: SttState }
  /** The running hypothesis, replaced by the next one and never appended to. */
  | { type: 'partial'; text: string }
  /**
   * A closed segment. Concatenated by the consumer, and the only thing that ever reaches a
   * text field.
   *
   * `language` is what the model detected, which is not a setting: a multilingual transducer
   * decides on its own and takes no instruction — see `expectedLanguage`.
   */
  | { type: 'final'; text: string; language: string; latencyMs: number }
  | { type: 'download'; progress: DownloadProgress }
  | { type: 'error'; failure: SttFailure }

/**
 * The state as it stands, for a window that arrives after the events it missed. Same push-and-pull
 * pairing the updater uses: there is no further event once a download has finished.
 */
export type SttSnapshot = {
  state: SttState
  /** Absent unless `state` is `downloadingModel`. */
  download: DownloadProgress | null
  /** Kept after the fact, so a window opened later still learns why the engine is not there. */
  failure: SttFailure | null
}

/** Holding a key to talk, or toggling it once and speaking freely. */
export type DictationMode = 'pushToTalk' | 'continuous'

export const DICTATION_MODES: readonly DictationMode[] = ['pushToTalk', 'continuous']

/**
 * The language the user expects to speak. Not passed to the engine — a NeMo transducer has no
 * language input and detects on its own. It is compared against what came back, so the interface
 * can say a segment was heard as something else rather than silently inserting it.
 */
export type ExpectedLanguage = 'auto' | 'fr' | 'en'

export const EXPECTED_LANGUAGES: readonly ExpectedLanguage[] = ['auto', 'fr', 'en']

/** A microphone the user may pick. Mirrors what `enumerateDevices` gives, minus everything else. */
export type InputDevice = { id: string; label: string }

/**
 * What the recogniser is fed. 16 kHz because that is what the model was trained at, and the
 * audio graph resamples natively — doing it in JavaScript would be both slower and worse.
 */
export const STT_SAMPLE_RATE = 16_000

/** 100 ms per chunk. Small enough that the level meter follows the voice, large enough to be cheap. */
export const STT_CHUNK_SAMPLES = 1_600

/**
 * Input level, 0 to 1. Not part of `SttEvent`: it is measured in the worklet that already holds
 * the samples, so sending it to the main process for it to send back would cost two crossings a
 * hundred times a minute to learn what the window knew first.
 */
export function rmsOf(samples: Float32Array): number {
  if (samples.length === 0) return 0

  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.min(1, Math.sqrt(sum / samples.length))
}

/**
 * One file of the model, and what proves it arrived intact. The digests are the LFS object ids
 * HuggingFace publishes, except `tokens.txt` which is not stored in LFS and was hashed by hand.
 *
 * Individual files rather than the `.tar.bz2` release: each one supports `Range`, so a download
 * resumes where it stopped, and a corrupted file costs its own size rather than all 640 MB.
 */
export type SttModelFile = {
  name: string
  url: string
  bytes: number
  sha256: string
}

const MODEL_BASE =
  'https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main'

/**
 * Parakeet TDT 0.6b v3, int8. Twenty-five European languages with automatic detection, and text
 * that comes out already punctuated and capitalised — so nothing here post-processes either.
 */
export const STT_MODEL_FILES: readonly SttModelFile[] = [
  {
    name: 'encoder.int8.onnx',
    url: `${MODEL_BASE}/encoder.int8.onnx`,
    bytes: 652_184_281,
    sha256: 'acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247',
  },
  {
    name: 'decoder.int8.onnx',
    url: `${MODEL_BASE}/decoder.int8.onnx`,
    bytes: 11_845_275,
    sha256: '179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e',
  },
  {
    name: 'joiner.int8.onnx',
    url: `${MODEL_BASE}/joiner.int8.onnx`,
    bytes: 6_355_277,
    sha256: '3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3',
  },
  {
    name: 'tokens.txt',
    url: `${MODEL_BASE}/tokens.txt`,
    bytes: 93_939,
    sha256: 'd58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d',
  },
]

export const STT_MODEL_BYTES = STT_MODEL_FILES.reduce((total, file) => total + file.bytes, 0)

/** Suffix of a download in flight. Nothing reads a `.part`, and an orphan is swept at startup. */
export const PART_SUFFIX = '.part'
