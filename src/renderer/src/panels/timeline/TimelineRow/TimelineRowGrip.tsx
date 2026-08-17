import { mdiDragVertical } from '@mdi/js'
import { use, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { isGoneForGood } from '@/helpers/teardown'
import { BandScrollContext } from '../bandScroll'
import type { RowReorder } from './rowReorder'

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

type TimelineRowGripProps = {
  height: number
  reorder: RowReorder
  /** Told for the length of the gesture, so the row it belongs to can read as held. */
  onHeld: (held: boolean) => void
}

/**
 * The grip a row is dragged by. A button rather than a bare div: reordering has to be reachable
 * from the keyboard too, and the arrow keys on a focused grip are the shortest way there.
 */
export function TimelineRowGrip({ height, reorder, onHeld }: TimelineRowGripProps) {
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
      latest.current.band?.onDrag(null)
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
    band?.onDrag({ pointerId: event.pointerId, y: event.clientY })
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
