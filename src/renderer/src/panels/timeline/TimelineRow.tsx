import { mdiDragVertical } from '@mdi/js'
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from 'react'
import { clamp } from '@shared/numeric'
import { UiIcon } from '@/design/UiIcon'
import { edgeScroll } from '@/engines/timeline/edge-scroll'
import { ROW_PADDING, RULER_HEIGHT } from '@/engines/timeline/timeline-geometry'
import { cn } from '@/helpers/cn'
import { isGoneForGood } from '@/helpers/teardown'

/**
 * How many places a row has travelled, dragged by this much over rows of this height.
 *
 * Rounded rather than truncated, so a row swaps once the pointer is past the MIDDLE of its
 * neighbour: waiting for a full height means the row one is dragging has already covered the one
 * it is about to pass, and the stack looks stuck for half the gesture.
 */
function reorderSteps(travelled: number, height: number): number {
  if (height <= 0) return 0
  return Math.round(travelled / height)
}

/**
 * What a band offers the rows inside it, so a drag can reach past what is on screen.
 *
 * Published by the column because the column is the only one that knows its own box AND the
 * height of the whole stack: a row knows neither, and the store keeps no viewport size.
 */
type BandScroll = {
  /** Opens and closes the band's own gesture — it only travels while a row is held. */
  onDrag: (dragging: boolean) => void
  /** Read at every step of a drag: an auto-scroll moves the stack under a pointer that is still. */
  scrollTop: () => number
}

const BandScrollContext = createContext<BandScroll | null>(null)

/**
 * How far the band could still travel — the stack it renders, less what it shows.
 *
 * Measured off the DOM and not off the store, which holds no viewport size: the column is the
 * only place in the studio that knows both numbers.
 */
function roomBelow(clip: HTMLElement | null, stack: HTMLElement | null): number {
  if (!clip) return 0
  return (stack?.offsetHeight ?? 0) - clip.clientHeight
}

/**
 * The column of headers standing beside a band: one row per line, scrolled with the band.
 *
 * Shared by the three for the same reason `TimelineRow` is — the montage and the dope sheet had
 * each written this box, down to the spacer facing the ruler, and a change to one left the other
 * a line out of step with the rows it names.
 */
export function TimelineHeaderColumn({
  scrollTop,
  onScrollTop,
  children,
}: {
  scrollTop: number
  /**
   * Where the band writes the offset it reaches on its own, ALREADY within its bounds — the
   * column measures the stack it renders, and nothing else in the studio can. Absent leaves the
   * band still: a stack no one can reorder never needs to come to the pointer.
   */
  onScrollTop?: (top: number) => void
  children: ReactNode
}) {
  const clip = useRef<HTMLDivElement>(null)
  const stack = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  // Read by the frame loop below, bound once for the whole gesture.
  const latest = useRef({ scrollTop, onScrollTop })
  useEffect(() => {
    latest.current = { scrollTop, onScrollTop }
  })

  // Stable for the column's whole life: a fresh object every draw would re-run the effect that
  // every grip inside binds to it, mid-gesture. State rather than a ref, which no component may
  // read while it renders.
  const [band] = useState<BandScroll>(() => ({
    onDrag: setDragging,
    scrollTop: () => latest.current.scrollTop,
  }))

  useEffect(() => {
    if (!dragging) return

    let y: number | null = null
    // `null` and not zero: a clock that starts at zero would read every frame as the first.
    let previous: number | null = null
    let frame = 0
    // Kept across frames: a sixtieth of a second of travel is a fraction of a pixel at the foot
    // of the ramp, and rounding each frame on its own would round every one of them to nothing.
    let carry = 0

    const onMove = (event: globalThis.PointerEvent): void => {
      y = event.clientY
    }

    const step = (now: number): void => {
      frame = requestAnimationFrame(step)

      const seconds = previous === null ? 0 : (now - previous) / 1000
      previous = now

      const write = latest.current.onScrollTop
      const box = clip.current
      if (y === null || !write || !box) return

      const room = roomBelow(clip.current, stack.current)
      if (room <= 0) return

      const edges = box.getBoundingClientRect()
      carry += edgeScroll(y, { top: edges.top, bottom: edges.bottom }, seconds)

      const whole = Math.trunc(carry)
      if (whole === 0) return
      carry -= whole

      const next = clamp(latest.current.scrollTop + whole, 0, room)
      if (next !== latest.current.scrollTop) write(next)
    }

    window.addEventListener('pointermove', onMove)
    frame = requestAnimationFrame(step)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [dragging])

  /**
   * The wheel over the NAMES, not only over the band beside them.
   *
   * The strip has always answered it; the column never did, so reading a stack meant carrying the
   * pointer off the very rows one was reading. Same offset, same bounds — the two halves of a
   * band cannot be scrolled apart.
   */
  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const room = roomBelow(clip.current, stack.current)
    if (!onScrollTop || room <= 0) return

    const next = clamp(Math.round(scrollTop + event.deltaY), 0, room)
    if (next !== scrollTop) onScrollTop(next)
  }

  return (
    <BandScrollContext value={band}>
      <div
        onWheel={onWheel}
        className="border-border flex w-(--sc-track-header) shrink-0 flex-col overflow-hidden border-r"
      >
        {/* Empty band facing the ruler, so line one lines up with row one. */}
        <div style={{ height: RULER_HEIGHT }} />
        <div ref={clip} className="min-h-0 flex-1 overflow-hidden">
          <div ref={stack} style={{ transform: `translateY(${-scrollTop}px)` }}>
            {children}
          </div>
        </div>
      </div>
    </BandScrollContext>
  )
}

/** What a row offers when it can be moved in the stack at all. */
export type RowReorder = {
  /** Accessible name of the grip — it says which row is being moved. */
  label: string
  /**
   * Moves the row, and answers how many places it ACTUALLY travelled — zero at the ends of the
   * stack, where there is nowhere to go.
   *
   * The answer is what keeps a drag honest. Counting the pointer instead, a row held against the
   * bottom edge banks steps it never took, and bringing the pointer back where it started spends
   * them the other way: the row climbs a place it was never dragged over.
   */
  move: (by: number) => number
  /**
   * Both ends of the drag, for a stack whose order is an EDIT: a row dragged across three places
   * has to cost one ⌘Z, not three. Absent where the order is a way of looking rather than a
   * change to the document — the dope sheet's arrangement, which no history holds.
   */
  begin?: () => void
  end?: () => void
}

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
  className,
  children,
  ...rest
}: TimelineRowProps) {
  const [held, setHeld] = useState(false)

  return (
    <div
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
        <RowGrip height={height} reorder={reorder} onHeld={setHeld} />
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

type Grab = {
  pointerId: number
  y: number
  /** Where the pointer stands now — the band can travel while it does not, and the rank follows. */
  at: number
  /** Where the band stood at the press: what it has travelled since counts as pointer travel. */
  scrollTop: number
  applied: number
  /** Held from the press, because `isGoneForGood` cannot be asked a ref React has already cleared. */
  node: HTMLButtonElement
}

/**
 * The grip a row is dragged by. A button rather than a bare div: reordering has to be reachable
 * from the keyboard too, and the arrow keys on a focused grip are the shortest way there.
 */
type RowGripProps = {
  height: number
  reorder: RowReorder
  /** Told for the length of the gesture, so the row it belongs to can read as held. */
  onHeld: (held: boolean) => void
}

function RowGrip({ height, reorder, onHeld }: RowGripProps) {
  // The pointer keeps travelling while the stack renumbers under it, so only the DIFFERENCE is
  // ever applied.
  const grabbed = useRef<Grab | null>(null)
  const [dragging, setDragging] = useState(false)

  // Absent for a row rendered on its own, outside any band — which is how this component is unit
  // tested, and the only case where nothing can scroll.
  const band = use(BandScrollContext)

  // Read by the window listeners below, which are bound once for the whole gesture: `reorder` is
  // a fresh object on every draw of its row, and rebinding on each would drop events mid-drag.
  const latest = useRef({ height, reorder, onHeld, band })
  useEffect(() => {
    latest.current = { height, reorder, onHeld, band }
  })

  /**
   * The gesture lives on the WINDOW, not on the grip, and pointer capture is deliberately not
   * used.
   *
   * A row that moves is a row React re-inserts in the DOM, and re-inserting a node releases the
   * capture it held — so the first rank the row travelled ended the drag, every time. `Tree.tsx`
   * carries the same note from the other side: it keeps its dragged row in place precisely
   * because a source moved mid-gesture stops firing. This band moves its rows for real, so the
   * listener has to sit somewhere the reordering cannot touch.
   */
  useEffect(() => {
    if (!dragging) return

    const release = (): void => {
      grabbed.current = null
      latest.current.onHeld(false)
      latest.current.band?.onDrag(false)
      latest.current.reorder.end?.()
    }

    const finish = (): void => {
      if (!grabbed.current) return
      release()
      setDragging(false)
    }

    /**
     * Where the row belongs now, given where the pointer stands and how far the band has come to
     * meet it. Run on every move AND on every frame: held at an edge the pointer emits nothing,
     * and it is the band that travels — without the frame the auto-scroll would slide the stack
     * past a row that never changed rank.
     */
    const settle = (): void => {
      const grab = grabbed.current
      if (!grab) return

      const held = latest.current
      const scrolled = (held.band?.scrollTop() ?? 0) - grab.scrollTop
      const steps = reorderSteps(grab.at - grab.y + scrolled, held.height)
      if (steps === grab.applied) return

      // What the stack GAVE, not what the pointer asked for — see `move`.
      const moved = held.reorder.move(steps - grab.applied)
      grabbed.current = { ...grab, applied: grab.applied + moved }
    }

    const onMove = (event: globalThis.PointerEvent): void => {
      // Only the pointer that STARTED the drag counts — the guard `ResizeHandle` spells out: a
      // mouse has no implicit capture, so a second pointer moving over the row would measure
      // against a stale origin and throw it several places at once.
      const grab = grabbed.current
      if (!grab || grab.pointerId !== event.pointerId) return

      // No button held any more: it came up somewhere this window never heard about — past its
      // own edge, or while another application had it. Giving up the capture is what costs that
      // `pointerup`, and the first move back inside is when we find out. Without this, the row
      // stays dimmed and armed for the rest of the session.
      if (event.buttons === 0) return finish()

      grabbed.current = { ...grab, at: event.clientY }
      settle()
    }

    const onUp = (event: globalThis.PointerEvent): void => {
      if (grabbed.current?.pointerId === event.pointerId) finish()
    }

    // Only where a band can travel: outside one, nothing moves the stack but the pointer, and a
    // frame could never answer differently from the move that came before it.
    let frame = 0
    const tick = (): void => {
      frame = requestAnimationFrame(tick)
      settle()
    }
    if (latest.current.band) frame = requestAnimationFrame(tick)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    // The window losing focus never delivers the release either — the same hole `useShortcuts`
    // closes for a held key, and for the same reason.
    window.addEventListener('blur', finish)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', finish)
      // Torn down with the pointer still down — a panel closed, a workspace left. BOTH halves go
      // back: the gesture the store holds open, and the row's own "I am held". But only for a
      // teardown that is real: React relocates the child that is out of order, which descending
      // IS the row one is holding, and releasing on that replay ended every downward drag.
      if (grabbed.current && isGoneForGood(grabbed.current.node)) release()
    }
  }, [dragging])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    // The row under the grip must not also take the press as a selection.
    event.stopPropagation()
    grabbed.current = {
      pointerId: event.pointerId,
      y: event.clientY,
      at: event.clientY,
      scrollTop: band?.scrollTop() ?? 0,
      applied: 0,
      node: event.currentTarget,
    }
    setDragging(true)
    onHeld(true)
    band?.onDrag(true)
    reorder.begin?.()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()

    // One press is one whole gesture, so it costs one entry wherever the order is an edit.
    reorder.begin?.()
    reorder.move(event.key === 'ArrowUp' ? -1 : 1)
    reorder.end?.()
  }

  return (
    <button
      type="button"
      // The name alone, with no tooltip and no focus ring: a grip stands on EVERY row of every
      // band, and a bubble explaining the obvious — the glyph is a grip, the cursor is a hand —
      // covered the rows underneath on the way past. Screen readers still get the name.
      aria-label={reorder.label}
      className={cn(
        'text-muted hover:text-text flex w-3 shrink-0 cursor-grab items-center justify-center',
        'outline-none active:cursor-grabbing',
      )}
      // The press alone: every other half of the gesture is bound on the window — see above.
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <UiIcon path={mdiDragVertical} size={12} />
    </button>
  )
}
