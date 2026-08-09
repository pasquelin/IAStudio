import { createContext, useContext, type ReactNode } from 'react'

const ScrollHost = createContext<HTMLElement | null>(null)

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

/** The published scroller, or `null` where nobody published one — then it has to be found. */
export function useScrollHost(): HTMLElement | null {
  return useContext(ScrollHost)
}
