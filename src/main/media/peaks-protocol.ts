/**
 * What the main process and the waveform worker say to each other.
 *
 * The worker spawns ffmpeg itself rather than being handed its output: an hour of audio is
 * 57 MB of PCM, and shipping that across a process boundary would cost more than the reduction
 * it was meant to move away (CLAUDE.md, invariant 6). Only the finished pairs come back.
 */

/** One waveform to reduce. Declared once: the request adds an id, the run adds a signal. */
export type PeaksJob = {
  binary: string
  args: string[]
  /** How many min/max pairs the waveform holds — derived from the probed duration. */
  buckets: number
  /** How many samples one pair covers, from the rate ffmpeg is asked to resample to. */
  samplesPerBucket: number
}

type PeaksRequest = PeaksJob & { id: number }

/** Cancels a request by id. A twenty-minute rush must stop on demand, mid-decode. */
export type PeaksCancel = { id: number; cancel: true }

export type PeaksMessage = PeaksRequest | PeaksCancel

export function isCancel(message: PeaksMessage): message is PeaksCancel {
  return 'cancel' in message
}

export type PeaksResponse =
  { id: number; ok: true; peaks: Float32Array } | { id: number; ok: false; error: string }
