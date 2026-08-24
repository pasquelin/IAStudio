/**
 * The list cut into runs of at most `size`, in order. An empty input gives NO batch rather than
 * one empty batch: callers send a request per batch, and an empty one would ask for nothing.
 *
 * Shared because both sides batch — the main against the endpoint's body limits, the window
 * against the channel's.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1')

  const batches: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size))
  }
  return batches
}
