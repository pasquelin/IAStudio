import { useState, type HTMLAttributes, type ReactNode } from 'react'
import { ROW_PADDING } from '@/engines/timeline/timelineGeometry'
import { cn } from '@/helpers/cn'
import type { RowReorder } from './rowReorder'
import { TimelineRowGrip } from './TimelineRowGrip'

export type TimelineRowProps = Omit<HTMLAttributes<HTMLDivElement>, 'style' | 'children'> & {
  height: number
  /** Absent for a row that holds no order of its own — a channel under its subject. */
  reorder?: RowReorder
  /**
   * A row that belongs to the one above it: a channel under its subject, a clip under its model.
   * It is indented, and it lays its content out on one line rather than stacking a name over a
   * row of controls — a nested row has never had both.
   */
  nested?: boolean
  /**
   * The rank a reader announces the row at, for the rows the DOM cannot place: the column is one
   * flat list, so a channel is the SIBLING of the subject it hangs off.
   *
   * Separate from `nested` on purpose, and the exposure sheet is why: a clip row is indented like
   * a channel but stacked in its own run at the END of the sheet, after every subject. Announced
   * at rank 2 it would claim to hang off whichever subject came last — the sheet was flat and
   * neutral before, and that would make it say something false.
   */
  level?: 1 | 2
  children: ReactNode
}

/**
 * One line of a header column, whichever band it belongs to.
 *
 * The three timelines of the studio — montage, animation, sound — show different things on their
 * rows and the SAME row: same padding, same grip column, same place for the name. What differs is
 * the content, which is what `children` is for. Each band had written its own, and the three had
 * drifted: half a gutter here, a quarter there, and controls of one gauge reading as three.
 */
export function TimelineRow({
  height,
  reorder,
  nested,
  level = 1,
  className,
  children,
  ...rest
}: TimelineRowProps) {
  const [held, setHeld] = useState(false)

  return (
    <div
      // Held here rather than left to the bands, as the padding and the grip column already are:
      // a row of this component is a line of a header column and never anything else. Before
      // `...rest`, so a caller that means something else still wins.
      role="listitem"
      // Said in words, or a sheet of four subjects and two channels each reads as "list, twelve
      // items", all at one rank — the indentation says it to the eye and to nobody else. `Tree`
      // says the same thing the same way, on `treeitem`.
      aria-level={level}
      className={cn(
        'flex items-stretch gap-0.5 px-1.5',
        // The row the hand is holding, for the length of the gesture — the same dimming the
        // outliner uses for the same thing, so one gesture does not read two ways in one studio.
        // Nothing else says a drag is under way: the stack reorders a rank at a time, and between
        // two ranks the hand held something invisible.
        held && 'bg-elevated opacity-40',
        className,
      )}
      style={{ height, paddingBlock: ROW_PADDING / 2 }}
      {...rest}
    >
      {reorder ? (
        <TimelineRowGrip height={height} reorder={reorder} onHeld={setHeld} />
      ) : (
        <div className={cn('shrink-0', nested ? 'w-5' : 'w-3')} />
      )}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          nested ? 'justify-center' : 'justify-between',
        )}
      >
        {children}
      </div>
    </div>
  )
}
