import type { ReactNode } from 'react'

export type WindowNavProps = {
  children: ReactNode
}

/**
 * The list filling the column of a window that is NOT a dock.
 *
 * It scrolls on its own rather than letting the column scroll, and that is the whole reason it
 * is a component: what a window pins around it — a search field above, a refresh below — has to
 * stay in place as the list grows past the window, and three windows had reached the same nine
 * classes to get there.
 */
export function WindowNav({ children }: WindowNavProps) {
  return (
    <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-auto p-0">
      {children}
    </ul>
  )
}
