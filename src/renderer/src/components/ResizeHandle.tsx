import { useCallback, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/helpers/cn'
import { usePointerDrag } from '@/hooks/usePointerDrag'

export type ResizeHandleProps = {
  /** `vertical` moves up and down and sets a height; `horizontal` sets a width. */
  axis: 'vertical' | 'horizontal'
  /** The panel grows as the pointer moves backwards — true for a right, bottom or lower half. */
  invert?: boolean
  /** Where the cut stands. Absent means CSS is dividing the box, and the handle measures it. */
  size?: number
  onSize: (size: number, available: number) => void
}

type Drag = { position: number; size: number; available: number }

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
  const drag = usePointerDrag<Drag>()
  const lying = axis === 'vertical'

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Only a drag that STARTED on this handle counts, or the panel would be resized from a
      // stale origin, or from zero, collapsing it to nothing.
      const current = drag.matching(event)
      if (!current) return

      const position = lying ? event.clientY : event.clientX
      const delta = position - current.position
      onSize(current.size + delta * (invert ? -1 : 1), current.available)
    },
    [drag, invert, lying, onSize],
  )

  return (
    <div
      role="separator"
      aria-orientation={lying ? 'horizontal' : 'vertical'}
      onPointerDown={event => {
        const room = (node: Element | null | undefined): number =>
          (lying ? node?.clientHeight : node?.clientWidth) ?? 0
        // The panel this handle moves is its SIBLING on the side `invert` names. Every caller that
        // leaves `size` out is laid out that way; one that is not has to pass its own number.
        const panel = invert
          ? event.currentTarget.nextElementSibling
          : event.currentTarget.previousElementSibling

        drag.start(event, {
          position: lying ? event.clientY : event.clientX,
          size: size ?? room(panel),
          available: room(event.currentTarget.parentElement),
        })
      }}
      onPointerMove={onMove}
      onPointerUp={drag.cancel}
      onPointerCancel={drag.cancel}
      onLostPointerCapture={drag.cancel}
      className={cn(
        'shrink-0 bg-transparent',
        lying
          ? 'h-(--sc-gutter) w-full cursor-row-resize'
          : 'h-full w-(--sc-gutter) cursor-col-resize',
      )}
    />
  )
}
