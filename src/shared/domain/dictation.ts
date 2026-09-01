/**
 * Offline dictation: what the renderer, the main process and the recognition worker all have to
 * agree on. The engine itself runs in a `utilityProcess` and never appears here.
 */
import { clamp } from '../numeric'
import type { DownloadProgress, LocalModel, ModelFile } from './localModel'

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

export type SttErrorCode =
  | 'permissionDenied'
  | 'noInputDevice'
  | 'modelDownloadFailed'
  | 'modelChecksumMismatch'
  | 'engineCrashed'

/** Enumerated, not just typed: the bundle guard walks it to demand a phrase in both languages. */
export const STT_ERROR_CODES: readonly SttErrorCode[] = [
  'permissionDenied',
  'noInputDevice',
  'modelDownloadFailed',
  'modelChecksumMismatch',
  'engineCrashed',
]

/**
 * A refusal, in two parts: the code the interface translates, and the detail it logs. The
 * message is never shown on its own — it names a file path or an ONNX symbol.
 */
export type SttFailure = { code: SttErrorCode; message: string }

export type { DownloadProgress } from './localModel'

export type SttEvent =
  | { type: 'state'; state: SttState }
  /** The running hypothesis, replaced by the next one and never appended to. */
  | { type: 'partial'; text: string }
  /**
   * A closed segment. Concatenated by the consumer, and the only thing that ever reaches a
   * text field.
   *
   * No language travels with it. Parakeet recognises twenty-five of them and reports none: the
   * `lang` field of a NeMo transducer result comes back empty, measured rather than assumed.
   * There is therefore nothing to lock and nothing to warn about.
   */
  | { type: 'final'; text: string; latencyMs: number }
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
 * Floats to the 16-bit samples that cross the boundary, clamped.
 *
 * Halves what is copied a hundred times a minute, and a microphone has nowhere near sixteen
 * bits of real dynamic range anyway. Done here rather than in the worklet because a worklet
 * cannot import anything — it would be a second copy of this, untested.
 */
export function toInt16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length)

  // Iterated rather than indexed, like `rmsOf` above: an index would need a `?? 0` that no
  // input can reach, and an unreachable branch is one a test can never account for.
  let index = 0
  for (const sample of samples) {
    // Scaled by 32767 on the way up and by 32768 on the way down: it is the pair that keeps a
    // full-scale sample inside the range in both directions.
    pcm[index] = Math.round(clamp(sample, -1, 1) * 32_767)
    index += 1
  }

  return pcm
}

/** The 16-bit samples back to the [-1, 1] floats the engine reads. */
export function toFloat(samples: Int16Array): Float32Array {
  const floats = new Float32Array(samples.length)

  let index = 0
  for (const sample of samples) {
    // 32768 rather than 32767: it is the magnitude of the most negative sample, so -32768 maps
    // to exactly -1 and nothing overshoots.
    floats[index] = sample / 32_768
    index += 1
  }

  return floats
}

/**
 * One file of the model, and what proves it arrived intact. The digests are the LFS object ids
 * HuggingFace publishes, except `tokens.txt` which is not stored in LFS and was hashed by hand.
 *
 * Individual files rather than the `.tar.bz2` release: each one supports `Range`, so a download
 * resumes where it stopped, and a corrupted file costs its own size rather than all 640 MB.
 */
export type SttModelRole = 'encoder' | 'decoder' | 'joiner' | 'tokens'

/**
 * One file of the model, and what proves it arrived intact.
 *
 * Narrows `ModelFile.role` to the four the engine asks for: the manifest describes any model, this
 * one is the recognition model and nothing else may take its place.
 */
export type SttModelFile = ModelFile & { role: SttModelRole }

const MODEL_BASE =
  'https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main'

/**
 * Parakeet TDT 0.6b v3, int8. Twenty-five European languages with automatic detection, and text
 * that comes out already punctuated and capitalised — so nothing here post-processes either.
 */
export const STT_MODEL_FILES: readonly SttModelFile[] = [
  {
    role: 'encoder',
    name: 'encoder.int8.onnx',
    url: `${MODEL_BASE}/encoder.int8.onnx`,
    bytes: 652_184_281,
    sha256: 'acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247',
  },
  {
    role: 'decoder',
    name: 'decoder.int8.onnx',
    url: `${MODEL_BASE}/decoder.int8.onnx`,
    bytes: 11_845_275,
    sha256: '179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e',
  },
  {
    role: 'joiner',
    name: 'joiner.int8.onnx',
    url: `${MODEL_BASE}/joiner.int8.onnx`,
    bytes: 6_355_277,
    sha256: '3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3',
  },
  {
    role: 'tokens',
    name: 'tokens.txt',
    url: `${MODEL_BASE}/tokens.txt`,
    bytes: 93_939,
    sha256: 'd58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d',
  },
]

export const STT_MODEL_BYTES = STT_MODEL_FILES.reduce((total, file) => total + file.bytes, 0)

/**
 * The recognition model as the catalogue holds it — the same files, plus what ADR-20 asks any
 * model to declare: its format, its loader, its licence and its rank.
 *
 * `[M]` The pair `onnx` × `sherpa-onnx` is the one measured admission of the whitelist: the studio
 * never deserialises the ONNX, it hands paths to an addon that registers no operator library.
 */
export const STT_MODEL: LocalModel = {
  id: 'parakeet-tdt-0.6b-v3-int8',
  name: 'Parakeet TDT 0.6b v3',
  format: 'onnx',
  loader: 'sherpa-onnx',
  rank: 1,
  licence: 'CC-BY-4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/legalcode',
  source: 'https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3',
  files: STT_MODEL_FILES,
  diskBytes: STT_MODEL_BYTES,
  // `[M]` The JSDoc of `armIdle` announced "returning around 700 MB" — a subtraction rather than a
  // measurement, which R2 of ADR-19 forbids. Kept as the reservation until a runtime answers.
  reservationBytes: 700_000_000,
  thumbnail: 'parakeet-tdt-0.6b-v3-int8.png',
}

/**
 * Where each file of the model sits, once it is on disk.
 *
 * Read from the same table the download uses, rather than spelled out again where the engine is
 * loaded: a model swapped for another would otherwise download four files and open four other
 * ones, and nothing — not a test, not the compiler — would say so.
 */
export function sttModelPaths(
  folder: string,
  join: (folder: string, name: string) => string,
): Record<SttModelRole, string> {
  const paths: Partial<Record<SttModelRole, string>> = {}
  for (const file of STT_MODEL_FILES) paths[file.role] = join(folder, file.name)

  // Every role is present: the type of `STT_MODEL_FILES` is what guarantees it, and the four
  // roles are the four files.
  return paths as Record<SttModelRole, string>
}
