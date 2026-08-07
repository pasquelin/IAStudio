import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/design/cn'

export type ResizeHandleProps = {
  /** `vertical` moves up and down and sets a height; `horizontal` sets a width. */
  axis: 'vertical' | 'horizontal'
  /** The panel grows as the pointer moves backwards — true for a right, bottom or lower half. */
  invert?: boolean
  size: number
  onSize: (size: number, available: number) => void
}

type Drag = { pointerId: number; position: number; size: number; available: number }

/**
 * Resize handle. Captures the pointer so the gesture survives a cursor leaving the handle —
 * without capture, a fast drag detaches.
 *
 * It also measures the container when the gesture starts and passes that dimension along: it
 * is the one that knows what is available, the store knows nothing about the DOM.
 *
 * It takes an axis rather than a zone because it serves both cuts: the one between a zone and
 * the documents area, and the one between a zone's two halves.
 */
export function ResizeHandle({ axis, invert = false, size, onSize }: ResizeHandleProps) {
  const drag = useRef<Drag | null>(null)
  const lying = axis === 'vertical'

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Only a drag that STARTED on this handle counts. A mouse has no implicit capture, so
      // a move with the button held from elsewhere reaches us too — and would resize from a
      // stale origin, or from zero, collapsing the panel to nothing.
      const current = drag.current
      if (!current || current.pointerId !== event.pointerId) return

      const position = lying ? event.clientY : event.clientX
      const delta = position - current.position
      onSize(current.size + delta * (invert ? -1 : 1), current.available)
    },
    [invert, lying, onSize],
  )

  return (
    <div
      role="separator"
      aria-orientation={lying ? 'horizontal' : 'vertical'}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const parent = event.currentTarget.parentElement
        drag.current = {
          pointerId: event.pointerId,
          position: lying ? event.clientY : event.clientX,
          size,
          available: lying
            ? (parent?.clientHeight ?? window.innerHeight)
            : (parent?.clientWidth ?? window.innerWidth),
        }
      }}
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onLostPointerCapture={() => (drag.current = null)}
      className={cn(
        'shrink-0 bg-transparent',
        lying
          ? 'h-(--sc-gutter) w-full cursor-row-resize'
          : 'h-full w-(--sc-gutter) cursor-col-resize',
      )}
    />
  )
}
