export type BoundedPool = {
  /** Runs the task once a slot is free, and frees it however the task ends. */
  run: <T>(task: () => Promise<T>) => Promise<T>
}

/**
 * A pool, not a burst — CLAUDE.md § 6. A folder of four hundred pictures scrolled past is four
 * hundred previews asked for at once, and each of them spawns work outside this process.
 *
 * The limit is read per acquisition rather than captured: it comes from a setting the user can
 * move while the studio runs.
 */
export function boundedPool(limit: () => number): BoundedPool {
  const waiting: (() => void)[] = []
  let active = 0

  return {
    run: async task => {
      if (active >= limit()) await new Promise<void>(resolve => waiting.push(resolve))
      active += 1

      try {
        return await task()
      } finally {
        active -= 1
        waiting.shift()?.()
      }
    },
  }
}
