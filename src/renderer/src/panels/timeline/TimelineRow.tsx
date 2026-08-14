import { mdiDragVertical } from '@mdi/js'
import {
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { TIP_RIGHT } from '@/helpers/tooltip'

/**
 * How many places a row has travelled, dragged by this much over rows of this height.
 *
 * Rounded rather than truncated, so a row swaps once the pointer is past the MIDDLE of its
 * neighbour: waiting for a full height means the row one is dragging has already covered the one
 * it is about to pass, and the stack looks stuck for half the gesture.
 */
export function reorderSteps(travelled: number, height: number): number {
  if (height <= 0) return 0
  return Math.round(travelled / height)
}

/** What a row offers when it can be moved in the stack at all. */
export type RowReorder = {
  /** Accessible name of the grip — it says which row is being moved. */
  label: string
  move: (by: number) => void
}

export type TimelineRowProps = Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'> & {
  height: number
  /** Absent for a row that holds no order of its own — a channel under its subject. */
  reorder?: RowReorder
  /** A row that belongs to the one above it, indented in its place. */
  nested?: boolean
  /**
   * `stack` puts a name over a row of controls, `center` lays one line out. Both keep the same
   * box, the same padding and the same grip column — which is the whole point of this component:
   * the montage and the dope sheet had each written their own, and the two drifted apart.
   */
  align?: 'stack' | 'center'
  children: ReactNode
}

/**
 * One line of a header column, whichever band it belongs to.
 *
 * The three timelines of the studio — montage, animation, sound — show different things on their
 * rows and the SAME row: same height for the grip, same padding, same place for the name. What
 * differs is the content, which is what `children` is for.
 */
export function TimelineRow({
  height,
  reorder,
  nested,
  align = 'stack',
  className,
  children,
  ...rest
}: TimelineRowProps) {
  return (
    <div
      className={cn('flex items-stretch gap-1 px-1.5 py-1', className)}
      style={{ height }}
      {...rest}
    >
      {reorder ? <RowGrip height={height} reorder={reorder} /> : <div className="w-3 shrink-0" />}
      {nested && <div className="w-2 shrink-0" />}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          align === 'stack' ? 'justify-between' : 'justify-center',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * The grip a row is dragged by. A button rather than a bare div: reordering has to be reachable
 * from the keyboard too, and the arrow keys on a focused grip are the shortest way there.
 */
function RowGrip({ height, reorder }: { height: number; reorder: RowReorder }) {
  // What the gesture started from, and how far it has already moved the row: the pointer keeps
  // travelling while the stack renumbers under it, so only the DIFFERENCE is ever applied.
  const grabbed = useRef<{ y: number; applied: number } | null>(null)

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    // The row under the grip must not also take the press as a selection.
    event.stopPropagation()
    grabbed.current = { y: event.clientY, applied: 0 }
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const grab = grabbed.current
    if (!grab) return

    const steps = reorderSteps(event.clientY - grab.y, height)
    if (steps === grab.applied) return

    reorder.move(steps - grab.applied)
    grabbed.current = { ...grab, applied: steps }
  }

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    grabbed.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    reorder.move(event.key === 'ArrowUp' ? -1 : 1)
  }

  return (
    <button
      type="button"
      {...TIP_RIGHT(reorder.label)}
      className="text-muted hover:text-text flex w-3 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <UiIcon path={mdiDragVertical} size={12} />
    </button>
  )
}
