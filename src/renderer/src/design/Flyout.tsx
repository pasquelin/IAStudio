import { useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/helpers/cn'

/** Which side of its anchor the menu hangs on. */
export type FlyoutPlacement = 'right' | 'above'

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

      if (placement === 'above') {
        // Right edges aligned: the status line anchors sit against the window edge, and a menu
        // hung from their left would run off it.
        node.style.top = `${box.top - node.offsetHeight - OFFSET}px`
        node.style.left = `${box.right - node.offsetWidth}px`
        return
      }
      node.style.top = `${box.top}px`
      node.style.left = `${box.right + OFFSET}px`
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
        'border-border bg-surface fixed z-50 flex min-w-40 flex-col gap-0.5',
        'rounded-(--radius-sc-lg) border p-1 shadow-(--sc-shadow-floating)',
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
