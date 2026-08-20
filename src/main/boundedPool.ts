export type BoundedPool = {
  /** Runs the task once a slot is free, and frees it however the task ends. */
  run: <T>(task: () => Promise<T>) => Promise<T>
}

/**
 * A pool, not a burst — CLAUDE.md § 6. A folder of four hundred pictures scrolled past is four
 * hundred previews asked for at once, and each of them spawns work outside this process.
 *
 * The slot is taken when the task is DISPATCHED, never after an await: counting afterwards lets
 * a caller arriving between a release and the waiter's resumption slip past a full pool.
 */
export function boundedPool(limit: () => number): BoundedPool {
  const waiting: (() => void)[] = []
  let running = 0

  const pump = (): void => {
    while (running < limit()) {
      const start = waiting.shift()
      if (!start) return

      running += 1
      start()
    }
  }

  return {
    run: <T>(task: () => Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        waiting.push(() => {
          const done = (): void => {
            running -= 1
            pump()
          }

          // `task()` itself is inside the try: a thunk that throws SYNCHRONOUSLY would otherwise
          // take its slot to the grave — the pool wedges after `limit` of them, and the promise
          // of whoever asked settles neither way.
          try {
            void task().then(
              value => {
                done()
                resolve(value)
              },
              (error: unknown) => {
                done()
                reject(error)
              },
            )
          } catch (error) {
            done()
            reject(error)
          }
        })

        pump()
      }),
  }
}
