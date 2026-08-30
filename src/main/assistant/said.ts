import { randomUUID } from 'node:crypto'

/**
 * What the last prompts carried, whole, for a reader who opens the journal and asks.
 *
 * 🛑 Keyed by the LAUNCH as well as the count: the key is written to `catalog.db` and outlives
 * the process, while the count restarts at 1 — a line from yesterday would otherwise unfold
 * today's briefing, plausible and wrong, on the very surface asked for to analyse a turn.
 */
export type Said = {
  /** Keeps one text and answers the key a journal line quotes it by. */
  keep: (text: string) => string
  /** What that key carried — nothing older than the ring, or written by another launch. */
  at: (key: string) => string | null
}

/** `[M]` Forty briefings of 90 505 characters, which V8 holds in two bytes each: some 7 Mo. */
const KEPT = 40

export function createSaid(): Said {
  const run = randomUUID()
  const said = new Map<string, string>()
  let last = 0

  return {
    keep: text => {
      last += 1
      const key = `${run}:${last}`
      said.set(key, text)
      // Exact rather than a walk: the counter is consecutive, so the one that falls out is named.
      said.delete(`${run}:${last - KEPT}`)

      return key
    },
    at: key => said.get(key) ?? null,
  }
}
