/**
 * What the main process and the recognition worker say to each other.
 *
 * The worker is handed paths, not weights: the model is 640 MB on disk, and shipping it across
 * a process boundary would cost more than loading it twice (CLAUDE.md, invariant 6). Audio goes
 * the other way in 100 ms chunks — small, constant, and the only thing that crosses often.
 */

/** Everything the engine needs to exist. Sent once; a second one reloads from scratch. */
export type SttLoad = {
  load: true
  encoder: string
  decoder: string
  joiner: string
  tokens: string
  vad: string
  threads: number
  /** Quiet that closes a segment, in milliseconds — seconds are the engine's unit, not ours. */
  silenceMs: number
  /** How often the segment in flight is decoded again for a preview. `0` turns previews off. */
  previewMs: number
}

/**
 * One chunk of speech, as 16-bit samples at 16 kHz.
 *
 * Int16 rather than Float32 across the boundary: it halves what is copied a hundred times a
 * minute, and the capture already produces it — the engine's own conversion back is a multiply
 * over 1600 values.
 */
export type SttAudio = { audio: Int16Array }

/** Close the speech in flight, so the last words are transcribed rather than dropped. */
export type SttFlush = { flush: true }

/** Drop the speech in flight. What was said is not transcribed and never reaches a field. */
export type SttCancel = { cancel: true }

export type SttMessage = SttLoad | SttAudio | SttFlush | SttCancel

export function isLoad(message: SttMessage): message is SttLoad {
  return 'load' in message
}

export function isAudio(message: SttMessage): message is SttAudio {
  return 'audio' in message
}

/**
 * The engine is up, or it is not. Answered before anything else is accepted: reading 640 MB of
 * weights can fail, and it has to fail at the opening rather than at the first sentence — the
 * same handshake `catalog-thread` waits on.
 */
export type SttReady = { ready: true } | { ready: false; error: string }

export type SttResult =
  | { partial: string }
  | { final: string; latencyMs: number }
  /** The ring buffer overflowed and older audio was dropped. Logged, never shown. */
  | { dropped: number }
  | { failed: string }

export type SttResponse = SttReady | SttResult

export function isReady(response: SttResponse): response is SttReady {
  return 'ready' in response
}
