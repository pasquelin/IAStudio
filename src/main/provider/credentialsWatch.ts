import type { Unsubscribe } from '@shared/ipc'

/**
 * Registers a cache to be dropped when the active account changes.
 *
 * Handed to whoever builds a cache rather than kept as a list at the composition root: a cache
 * added later subscribes where it is built, and cannot be left out of a purge list nobody
 * thinks to reread. That omission has already happened once — the model catalogue of one
 * account stayed on screen under the next.
 */
export type WatchCredentials = (purge: () => void) => Unsubscribe

export type CredentialsWatch = {
  watch: WatchCredentials
  /** Runs every purge, in subscription order. */
  changed: () => void
}

export function createCredentialsWatch(): CredentialsWatch {
  const purges = new Set<() => void>()

  return {
    watch: purge => {
      purges.add(purge)
      return () => {
        purges.delete(purge)
      }
    },

    // Over a copy: a purge that unsubscribes as it runs would otherwise skip its neighbour.
    changed: () => {
      for (const purge of [...purges]) purge()
    },
  }
}
