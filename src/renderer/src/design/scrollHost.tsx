import { createContext, type ReactNode } from 'react'

/**
 * `undefined` means nobody published one; `null` means one was published but has not mounted
 * yet. Collapsing the two would send a surface off to guess on the render where its own page is
 * about to tell it — so the heuristic would still be doing the work at mount, which is the whole
 * thing this replaces.
 *
 * Exported for `useScrollHost` alone, which reads it: a hook lives under `hooks/`, so the context
 * and the one hook that consumes it cannot share a file.
 */
export const ScrollHost = createContext<HTMLElement | null | undefined>(undefined)

export type ScrollHostProviderProps = {
  /** The element that actually scrolls. `null` until the page has mounted its own. */
  host: HTMLElement | null
  children: ReactNode
}

/**
 * Publishes the element a page scrolls in, for the surfaces inside it that virtualize against a
 * scroll they do not own.
 *
 * Told rather than guessed. `Masonry` walked up the tree looking for an `overflow` that scrolls,
 * which works and says nothing: the page's scroll is an invariant several things depend on — the
 * grid's virtualization, and the sticky heading of `Section` — and neither of them could state
 * that dependency. A page that stops owning its scroll now breaks a context, not a heuristic.
 */
export function ScrollHostProvider({ host, children }: ScrollHostProviderProps) {
  return <ScrollHost.Provider value={host}>{children}</ScrollHost.Provider>
}
