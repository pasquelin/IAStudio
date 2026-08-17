import { useCallback, useState } from 'react'

/**
 * What `useContextMenu` needs of a right-click, and no more: a React synthetic event satisfies it,
 * and so does a plain object, which is what lets the hook be exercised without a DOM.
 */
export type ContextMenuGesture = {
  preventDefault: () => void
  clientX: number
  clientY: number
}

/**
 * For the DRAWN menu, not the system one — `helpers/contextMenu.ts` holds that path, and no state.
 * `open` is the handler rather than a setter: the `preventDefault` that keeps the platform menu
 * away is not a caller's choice, so a host wanting it through decides before calling. Both stay
 * stable, or an open menu re-subscribes its global listeners on every render of its host.
 */
export function useContextMenu(): {
  at: { x: number; y: number } | null
  open: (event: ContextMenuGesture) => void
  close: () => void
} {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)

  const open = useCallback((event: ContextMenuGesture) => {
    event.preventDefault()
    setAt({ x: event.clientX, y: event.clientY })
  }, [])

  const close = useCallback(() => setAt(null), [])

  return { at, open, close }
}
