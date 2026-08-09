/**
 * Reconciling a stored order with the registry this build declares. The bar of spaces and the
 * home's bands both need it, and both had written it out — the subtle half, where a newcomer
 * belongs, twice.
 *
 * A stored order is a photograph of what existed the day it was written: an entry since dropped
 * would draw a hole, and one since added would be invisible to everyone who had already arranged
 * theirs. So a newcomer lands where the registry declares it — right after the last of its
 * earlier neighbours the reader kept — rather than at the end, and the reason the registry is
 * ordered survives.
 *
 * `kept` is the stored order already cleaned of what this build no longer knows: only the caller
 * can say what a valid entry is, and it is the same pass that drops the malformed ones.
 */
export function reconcileOrder<T, K>(
  kept: readonly T[],
  registry: readonly T[],
  keyOf: (item: T) => K,
): T[] {
  const order = [...kept]

  for (const [index, entry] of registry.entries()) {
    if (order.some(item => keyOf(item) === keyOf(entry))) continue

    let at = 0
    for (const earlier of registry.slice(0, index)) {
      const found = order.findIndex(item => keyOf(item) === keyOf(earlier))
      if (found >= 0) at = found + 1
    }

    order.splice(at, 0, entry)
  }

  return order
}
