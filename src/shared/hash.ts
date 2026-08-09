/**
 * A stable spelling for a value, and a short digest of one — what a cache key is made of.
 *
 * Here rather than beside its one caller because nothing in it knows what it is hashing, and
 * because `shared/` is the only ground both processes stand on: `node:crypto` does not exist in
 * the renderer (invariant 1), and `crypto.subtle` only answers asynchronously, which would make
 * every caller async for nothing. 64 bits rather than 32 because a cache is keyed by this, and a
 * collision hands one entry another entry's result.
 *
 * BigInt costs several times what the same hash on two 32-bit lanes would, which has not been
 * worth taking so far — `engines/graph/plan.bench.ts` prices the largest graph the studio can
 * hold, and it is a small fraction of a frame. Re-run it before trading this for a faster one.
 */

const OFFSET_BASIS = 14695981039346656037n
const PRIME = 1099511628211n
const SIXTY_FOUR_BITS = 0xffffffffffffffffn

const BYTES = new TextEncoder()

export function digest(value: string): string {
  let hash = OFFSET_BASIS

  for (const byte of BYTES.encode(value)) {
    hash = ((hash ^ BigInt(byte)) * PRIME) & SIXTY_FOUR_BITS
  }

  return hash.toString(16).padStart(16, '0')
}

/** What `JSON.stringify` leaves out of an object, and what this leaves out for the same reason. */
const isDropped = (value: unknown): boolean =>
  value === undefined || typeof value === 'function' || typeof value === 'symbol'

/**
 * The same value, always spelled the same way — which `JSON.stringify` does not promise: it
 * writes an object's keys in insertion order, so a form filled in another order reads as another
 * form and a cached node would run again for nothing.
 *
 * Not JSON, and not meant to be parsed back: it is only ever fed to `digest`.
 */
export function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`

  if (value !== null && typeof value === 'object') {
    const written = Object.keys(value)
      .sort()
      .flatMap(key => {
        const held = Reflect.get(value, key)
        return isDropped(held) ? [] : [`${JSON.stringify(key)}:${stableKey(held)}`]
      })

    return `{${written.join(',')}}`
  }

  // `undefined` has no spelling of its own, exactly as inside an array — a key holding one was
  // dropped above, so the two cannot be confused with each other here.
  return JSON.stringify(value) ?? 'null'
}
