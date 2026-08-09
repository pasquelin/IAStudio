import { useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/helpers/cn'
import { useDismiss } from '@/hooks/useDismiss'
import { MENU_SURFACE } from './styles'

export type ContextMenuProps = {
  /** Where the pointer was. Viewport coordinates, as a right-click reports them. */
  at: { x: number; y: number }
  onClose: () => void
  children: ReactNode
}

/** Kept off the window edges, so a menu opened near one is not half outside it. */
const MARGIN = 8

/**
 * A menu at the pointer, rather than hung from a control.
 *
 * `Flyout` anchors to an element and cannot serve this: a right-click has coordinates and no
 * anchor. Everything else is shared — the rows are `MenuRow`, the surface is the same token, and
 * it portals to the document root for the same reason (a menu drawn inside a panel is clipped by
 * the panel's own overflow).
 */
export function ContextMenu({ at, onClose, children }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement | null>(null)

  // A press inside is a row being chosen; the row closes the menu itself.
  useDismiss(onClose, menu)

  // Placed through a callback ref rather than state, as `Flyout` does: measuring in an effect
  // would draw the menu once off-screen and then move it. Memoised because React re-runs a
  // callback ref whose identity changed, and each run forces a layout read then two writes.
  const place = useCallback(
    (node: HTMLDivElement | null): void => {
      menu.current = node
      if (!node) return

      const box = node.getBoundingClientRect()
      const x = Math.min(at.x, window.innerWidth - box.width - MARGIN)
      const y = Math.min(at.y, window.innerHeight - box.height - MARGIN)

      node.style.left = `${Math.max(MARGIN, x)}px`
      node.style.top = `${Math.max(MARGIN, y)}px`
    },
    [at],
  )

  return createPortal(
    <div
      ref={place}
      role="menu"
      className={cn(MENU_SURFACE, 'min-w-44')}
      onContextMenu={event => event.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}
