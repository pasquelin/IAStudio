/**
 * One loaded thing per key, however many holders point at it, freed when the last one lets go.
 *
 * Reference counted rather than kept for the session: the GPU memory of a texture nobody
 * displays, or of a model no node shows, is memory the viewport lacks.
 *
 * Written once rather than per cache because the race it handles is subtle: a holder that lets
 * go while the load is still in flight must free what arrives rather than keep it for a holder
 * that no longer exists. Getting that wrong leaks silently, and only under load.
 */
export type RefCache<T> = {
  /** Takes a reference, loading if nobody holds one. `null` if it failed, or was released in flight. */
  acquire: (key: string) => Promise<T | null>
  /** Gives a reference back. The value is freed once the last one goes. */
  release: (key: string) => void
  /** Frees everything, whoever still holds it — the engine is going away. */
  dispose: () => void
}

export type RefCacheOptions<T> = {
  load: (key: string) => Promise<T>
  free: (value: T) => void
  /** Told when a load fails. Injected like `load`, so the cache knows no more than it must. */
  onFailure: (key: string, error: unknown) => void
}

type Entry<T> = {
  references: number
  loading: Promise<T | null>
  value: T | null
}

export function createRefCache<T>({ load, free, onFailure }: RefCacheOptions<T>): RefCache<T> {
  const entries = new Map<string, Entry<T>>()

  const drop = (key: string, entry: Entry<T>): void => {
    entries.delete(key)
    if (entry.value !== null) free(entry.value)
  }

  return {
    acquire: key => {
      const existing = entries.get(key)
      if (existing) {
        existing.references += 1
        return existing.loading
      }

      const loading = load(key).then(
        value => {
          // Released while it was in flight: freed here rather than kept for a holder that no
          // longer exists.
          if (entries.get(key) !== entry) {
            free(value)
            return null
          }
          entry.value = value
          return value
        },
        error => {
          // A failure leaves the caller without, rather than the panel broken — a missing file
          // is an ordinary thing in a project that moved. The next acquire tries again.
          //
          // Only if the entry is still this one: released and re-acquired while it was in
          // flight, deleting blindly would evict the load that is about to succeed — and
          // reporting a stale failure would blame a file the scene is about to draw.
          if (entries.get(key) !== entry) return null

          entries.delete(key)
          onFailure(key, error)
          return null
        },
      )

      const entry: Entry<T> = { references: 1, loading, value: null }
      entries.set(key, entry)
      return loading
    },

    release: key => {
      const entry = entries.get(key)
      if (!entry) return

      entry.references -= 1
      if (entry.references <= 0) drop(key, entry)
    },

    dispose: () => {
      for (const [key, entry] of [...entries]) drop(key, entry)
    },
  }
}
