import { createHash } from 'node:crypto'

/** An embedding, and the two things ever done with one: written to a blob, and compared. */

export type MemoryVector = {
  memoryId: string
  /** Changing model INVALIDATES: two models' vectors do not live in one space. */
  model: string
  /** What was embedded, digested — see `digestOf`. What ties this vector to those words. */
  digest: string
  values: Float32Array
}

/** A memory still waiting for its vector, with the words to make it and the digest of them. */
export type PendingVector = {
  id: string
  text: string
  digest: string
}

/** Unit length, so a comparison is a dot product. All zeroes comes back as it went in. */
export function normalised(values: Float32Array): Float32Array {
  let sum = 0
  for (const value of values) sum += value * value
  if (sum === 0) return values

  const length = Math.sqrt(sum)
  const unit = new Float32Array(values.length)
  for (let at = 0; at < values.length; at++) unit[at] = (values[at] ?? 0) / length
  return unit
}

/**
 * The vector as the column holds it — a VIEW, since binding copies the bytes before `run` returns.
 * Written in the machine's own byte order and read back the same way by `dotOfBytes`: the index is
 * derived and never travels, and every target the studio ships to is little-endian.
 */
export function packed(values: Float32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength)
}

/**
 * How alike a STORED vector and a question are, read straight off the bytes.
 *
 * `[M]` 10 000 of 768 dimensions: 11,8 ms this way against 21,3 ms unpacked first, and it
 * allocates nothing — a recall sweeps every vector, so the copy was the second cost of a turn.
 */
export function dotOfBytes(stored: Uint8Array, question: Float32Array): number {
  if (stored.byteLength !== question.length * Float32Array.BYTES_PER_ELEMENT) return 0

  const view = new DataView(stored.buffer, stored.byteOffset, stored.byteLength)
  let sum = 0
  for (let at = 0; at < question.length; at++) {
    sum += view.getFloat32(at * Float32Array.BYTES_PER_ELEMENT, true) * (question[at] ?? 0)
  }

  return sum
}

/** Both halves, because both halves are what a memory MEANS — a path or a name lives in the body. */
export function embeddedTextOf(summary: string, body: string): string {
  return `${summary}\n${body}`.trim()
}

/**
 * 🛑 What decides whether a memory still has its embedding, and why it is a DIGEST rather than a
 * row reference: reading the file back rewrites every memory, and keyed by row every vector would
 * be recomputed there — `[M]` 24 ms each, so four minutes for ten thousand.
 */
export function digestOf(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}
