import { useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/helpers/cn'
import { useDismiss } from '@/hooks/useDismiss'
import { MENU_SURFACE } from './styles'

/** Which side of its anchor the menu hangs on. */
export type FlyoutPlacement = 'right' | 'above' | 'below'

export type FlyoutProps = {
  anchor: HTMLElement | null
  children: ReactNode
  placement?: FlyoutPlacement
  /**
   * Declared rather than assumed. `role="menu"` promises rows a screen reader can step through,
   * and the surface also serves panels and sliders — announcing a menu that has no menu items
   * sends a reader looking for something that is not there.
   */
  role?: 'menu'
  /**
   * Closes on a press outside, on `Escape`, and when the window loses focus. Optional because
   * the hover callers already close on pointer-out, with a grace period a global `pointerdown`
   * would fight. Must be stable — it is what the listeners hang off.
   */
  onDismiss?: () => void
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}

/**
 * Gap between the bar and its rows. Kept small on purpose: every pixel here is a pixel the
 * pointer crosses over nothing, and `useHoverFlyout`'s grace period has to cover it.
 */
const OFFSET = 2

/** Kept inside the window: rows drawn past its edge cannot be reached, by pointer or by key. */
function clamped(wanted: number, size: number, within: number): number {
  return Math.max(0, Math.min(wanted, within - size))
}

/**
 * The rows of a tool's modes, laid beside the bar.
 *
 * Portalled to the document root rather than rendered in place: a toolbar is a rounded surface
 * with its own overflow, and a menu drawn inside it gets clipped by its edge. Same rule as
 * map3D's anchored panels.
 */
export function Flyout({
  anchor,
  children,
  placement = 'right',
  role,
  onDismiss,
  onPointerEnter,
  onPointerLeave,
}: FlyoutProps) {
  const panel = useRef<HTMLDivElement | null>(null)

  useDismiss(onDismiss, panel, anchor)

  // Placed through a callback ref rather than state: measuring in an effect and storing the
  // result would render the menu once at the wrong place, then move it.
  const place = useCallback(
    (node: HTMLDivElement | null) => {
      panel.current = node
      if (!node || !anchor) return
      const box = anchor.getBoundingClientRect()

      if (placement === 'right') {
        node.style.top = `${clamped(box.top, node.offsetHeight, window.innerHeight)}px`
        // Flipped to the other side when the anchor sits too near the right edge. A section
        // heading reaches the very edge of the window, and its menu was drawn outside it.
        const beside = box.right + OFFSET
        const fits = beside + node.offsetWidth <= window.innerWidth
        // Clamped like every other placement, the flip included: a menu wider than the room to
        // the left of its anchor lands at a negative x, and runs off the side it flipped to.
        const wanted = fits ? beside : box.left - node.offsetWidth - OFFSET
        node.style.left = `${clamped(wanted, node.offsetWidth, window.innerWidth)}px`
        return
      }

      // Both stacked placements align right edges: the status line and the title bar anchor
      // against the window edge, and a menu hung from their left would run off it.
      const above = placement === 'above'
      node.style.top = `${above ? box.top - node.offsetHeight - OFFSET : box.bottom + OFFSET}px`
      node.style.left = `${clamped(box.right - node.offsetWidth, node.offsetWidth, window.innerWidth)}px`
    },
    [anchor, placement],
  )

  if (!anchor) return null

  return createPortal(
    <div
      ref={place}
      role={role}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={cn(
        MENU_SURFACE,
        'min-w-40',
        // The scene's Add menu is 22 rows: unbounded it runs off the bottom of the window,
        // and the rows past the edge are unreachable.
        'max-h-[min(60vh,32rem)] overflow-y-auto',
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
