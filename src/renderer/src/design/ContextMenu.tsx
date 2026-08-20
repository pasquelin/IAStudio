import { useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/helpers/cn'
import type { ContextMenuAt } from '@/hooks/useContextMenu'
import { useDismiss } from '@/hooks/useDismiss'
import { useMenuKeys } from '@/hooks/useMenuKeys'
import { MENU_SURFACE } from './styles'

export type ContextMenuProps = {
  /** Where the pointer was — `useContextMenu` is what produces it. */
  at: ContextMenuAt
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
 *
 * **The portal does not detach it from what raised it.** React bubbles synthetic events through
 * the React tree, not the DOM one, so every press here still reaches the element the menu was
 * opened over — which in a `Collection` is a cell that opens a project on a single click. The
 * menu therefore stops its own presses: it is a surface of its own, and nothing chosen in it is
 * also a press on what lies underneath.
 */
export function ContextMenu({ at, onClose, children }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement | null>(null)

  // A press inside is a row being chosen; the row closes the menu itself.
  useDismiss(onClose, menu)

  // Opened from the keyboard, the menu used to leave focus where it was — and it portals to the
  // end of `body`, so reaching it meant tabbing through the whole document.
  useMenuKeys(menu, onClose)

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
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      onContextMenu={event => {
        event.preventDefault()
        // Or the host that opened this menu takes the press for a fresh right-click and
        // re-anchors the open menu under the pointer, which is how one tries to dismiss it.
        event.stopPropagation()
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
