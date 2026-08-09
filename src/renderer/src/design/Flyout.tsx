import { useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/helpers/cn'
import { MENU_SURFACE } from './styles'

/** Which side of its anchor the menu hangs on. */
export type FlyoutPlacement = 'right' | 'above' | 'below'

export type FlyoutProps = {
  anchor: HTMLElement | null
  children: ReactNode
  placement?: FlyoutPlacement
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
  onPointerEnter,
  onPointerLeave,
}: FlyoutProps) {
  // Placed through a callback ref rather than state: measuring in an effect and storing the
  // result would render the menu once at the wrong place, then move it.
  const place = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !anchor) return
      const box = anchor.getBoundingClientRect()

      if (placement === 'right') {
        node.style.top = `${clamped(box.top, node.offsetHeight, window.innerHeight)}px`
        // Flipped to the other side when the anchor sits too near the right edge. A section
        // heading reaches the very edge of the window, and its menu was drawn outside it.
        const beside = box.right + OFFSET
        const fits = beside + node.offsetWidth <= window.innerWidth
        node.style.left = `${fits ? beside : box.left - node.offsetWidth - OFFSET}px`
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
      role="menu"
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
