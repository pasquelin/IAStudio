import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import type { DragLike } from '@/helpers/drag'
import { pickFrom, type Modifiers, type SelectionMode } from '@/helpers/selection'
import { isTyping } from '@/helpers/typing'
import { useRemeasure } from '@/hooks/useRemeasure'
import { useRowHeight } from '@/hooks/useRowHeight'
import { rowDrag } from './rowDrag'
import { ROW_LINE, rowSkin } from './styles'
import { UiIcon } from './UiIcon'

export type TreeNode = { id: string; parentId: string | null }

/** A pick that composes with nothing — what aiming a menu at a row asks for. */
const NO_MODIFIERS: Modifiers = { shiftKey: false, metaKey: false, ctrlKey: false }

/**
 * How long a folder is hovered, mid-drag, before it opens by itself. Under ~400 ms one merely
 * CROSSED opens by accident and reflows the list under a moving pointer; past ~800 ms the hand has
 * already dropped short. This is about where a deliberate hover parts from a transit.
 */
const HOVER_EXPAND_MS = 600

/** Where in a row the pointer is: its edges insert beside it, its middle drops into it. */
type DropZone = 'before' | 'into' | 'after'

/** What releasing over a row would do. An insertion carries where it would land. */
type DropTarget =
  { zone: 'into' } | { zone: 'before' | 'after'; parentId: string | null; index: number }

/**
 * A drag from somewhere else, and what releasing it here does. Shared with the grid that reads
 * the same folder, so the two views of one panel answer one gesture the same way.
 *
 * `carries` is asked at HOVER, so it must read the announced types and never the payload — the
 * platform answers nothing about the latter until the drop itself.
 */
export type ForeignDrop<T> = {
  carries: (event: DragLike) => boolean
  /**
   * Which rows receive it. Its own rather than `droppable`, which answers about the batch this
   * tree picked up: asked with an empty one it drops the very test that refuses a destination —
   * `canMoveInto` is a question about a PAIR, and there is no source here to make the pair.
   */
  accepts: (node: T) => boolean
  /** `null` for the blank below the rows, which means the folder being read. */
  onDrop: (event: React.DragEvent<HTMLElement>, node: T | null) => void
}

export type TreeRow<T> = {
  node: T
  depth: number
  hasChildren: boolean
  expanded: boolean
  /** Which of its siblings this is, from one — what a reader announces as « 3 of 12 ». */
  position: number
  /** How many siblings it has. Counted here because the tree is flattened and virtualized: the
   * DOM holds a window of rows and no nesting at all, so nothing else could say it. */
  siblings: number
}

/**
 * Flattens the tree into the rows actually on screen. A node whose parent is missing is dropped
 * rather than promoted to a root: silently reparenting an orphan hides the bug that produced it.
 */
export function flattenTree<T extends TreeNode>(
  nodes: readonly T[],
  expandedIds: ReadonlySet<string>,
  expandable?: (node: T) => boolean,
): TreeRow<T>[] {
  const byParent = new Map<string | null, T[]>()
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId)
    if (siblings) siblings.push(node)
    else byParent.set(node.parentId, [node])
  }

  const rows: TreeRow<T>[] = []
  const walk = (parentId: string | null, depth: number): void => {
    const among = byParent.get(parentId) ?? []
    for (const [index, node] of among.entries()) {
      // Asked rather than derived when the caller knows better: a folder nobody has expanded
      // has no children LOADED, and a tree that read that as "no children" would draw no
      // chevron — leaving the folder impossible to open at all.
      const hasChildren = expandable ? expandable(node) : byParent.has(node.id)
      const expanded = expandedIds.has(node.id)
      rows.push({ node, depth, hasChildren, expanded, position: index + 1, siblings: among.length })
      if (hasChildren && expanded) walk(node.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

export type TreeProps<T extends TreeNode> = {
  nodes: readonly T[]
  /**
   * What the tree is called. A `tree` is a widget, and an unnamed widget is announced as the
   * bare word "tree" — the same word in every panel of the studio that draws one. `Collection`
   * carries the same prop for the same reason.
   */
  label: string
  /** Ordered; the last one is the anchor a shift-click extends from. */
  selectedIds: readonly string[]
  expandedIds: ReadonlySet<string>
  /** What the click asked for, already resolved against the rows on screen. */
  onSelect: (ids: readonly string[], mode: SelectionMode) => void
  onToggle: (id: string) => void
  /**
   * Which rows a selection may hold. A synthetic header answers `false` and is left out of a
   * range rather than filtered off afterwards by whoever stores the result.
   */
  selectable?: (node: T) => boolean
  /**
   * Whether a node can hold children, when the tree cannot tell. A file browser loads a folder
   * only once it is opened, so "has no children yet" and "is a leaf" look the same from here.
   */
  expandable?: (node: T) => boolean
  /**
   * Opening a row — a double-click, or `Enter`. Absent, `Enter` picks as `Space` does, which is
   * what an outliner wants: there is nothing to open, only something to select.
   */
  onActivate?: (node: T) => void
  /**
   * A right-click on a row. Absent leaves the browser's own menu. Takes no coordinates: the
   * system pops the menu where the pointer already is.
   */
  onContextMenu?: (node: T) => void
  /**
   * Rows were dropped onto another. Absent leaves the tree undraggable — a tree with nothing to
   * reorder that offered the gesture would promise something it cannot do — unless `onInsert`
   * is there, which is the other half of the same gesture.
   *
   * A LIST, always, and one element long unless `dragMultiple` says otherwise. The first is the
   * row the hand actually took hold of.
   */
  onDrop?: (ids: readonly string[], parentId: string) => void
  /**
   * A row was dropped BETWEEN two others: `parentId` is the level receiving it, `null` at the
   * root, and `index` its place among that level's rows once the moved one has left them — the
   * arithmetic every caller would otherwise redo, and get subtly wrong in the one case where a
   * row moves down within its own level.
   *
   * Absent, a row is a target over its whole height and the tree only reparents. Present, the
   * edges of a row insert and its middle reparents; where nothing can be dropped INTO a row,
   * the two edges share it, because a third of a row that nothing lands in is a third of a row
   * the hand keeps missing.
   */
  onInsert?: (ids: readonly string[], parentId: string | null, index: number) => void
  /**
   * Which rows may be picked up. A row that cannot move never becomes draggable, so the refusal
   * is in the hand rather than at the release: a gesture that runs its course and then does
   * nothing is the one outcome worse than no gesture.
   */
  draggable?: (node: T) => boolean
  /**
   * Whether taking hold of a SELECTED row takes the whole selection with it.
   *
   * Off by default, which is what leaves the outliner and the layer stack exactly as they were:
   * a tree that reorders one node at a time gains nothing from carrying three, and the index a
   * drop lands on is arithmetic written for one row moving.
   *
   * A row OUTSIDE the selection is always dragged alone, and the selection is left whole — the
   * behaviour of every file browser, and what keeps a slip of the hand from moving thirty files.
   */
  dragMultiple?: boolean
  /**
   * Rows were dropped on the BLANK below the tree, which means "out of every row" — to the
   * project folder itself, for a file browser.
   *
   * Absent, the blank refuses like any other non-target. It exists because a tree whose rows are
   * the only destinations can take a file INTO a folder and never back out of it, and there is
   * no row standing for the root to aim at.
   */
  onDropRoot?: (ids: readonly string[]) => void
  /**
   * A drag that did NOT start in this tree — the asset shelf's, for the Explorer.
   *
   * It lands INSIDE a row or on the blank, never between two: what it carries is not a row of
   * this tree, so it has no place in an ordering. Everything else the hover already does is
   * unchanged, spring-loaded folders included — that is the whole reason it is a prop here
   * rather than a second set of handlers written beside the tree.
   *
   */
  foreign?: ForeignDrop<T>
  /**
   * A right-click on that same blank, which aims at the same place a drop there does: the project
   * folder itself. Absent leaves the browser's own menu.
   *
   * Its own prop rather than `onContextMenu(null)`, because the two menus are not the same menu
   * shortened — the root cannot be opened, renamed, copied or thrown away, and a row that stands
   * for nothing would have to be guarded at every one of them.
   */
  onContextMenuRoot?: () => void
  /**
   * A row has just been picked up, so its owner may announce the drag on a channel of its own —
   * a scene document laid on a montage, say. The tree has already announced its own by then,
   * and neither channel knows about the other.
   */
  onDragStart?: (node: T, event: React.DragEvent<HTMLElement>) => void
  /**
   * Which rows may receive `dragged`. Refused rows take no outline and no drop, which is why
   * the tree keeps the dragged node rather than reading the drag payload: `getData` answers
   * nothing until the drop itself, so a target asked at hover has no other way to know what is
   * coming. It is also what tells a drag that began in ANOTHER tree — the channel is shared —
   * from one of this tree's own rows.
   *
   * Asked about the WHOLE batch at once rather than once per member: a caller refusing three
   * files where one of them is the destination's own ancestor has to see all three, and a
   * per-member answer would outline a row the drop then refuses.
   */
  droppable?: (node: T, dragged: readonly T[]) => boolean
  /** Draws the row's content. The tree owns the chevron, the indent and the selection. */
  renderRow: (row: TreeRow<T>) => ReactNode
  /**
   * Draws a column pinned to the RIGHT EDGE, outside the indentation — the visibility eye of a
   * layer stack and of the scene outliner.
   *
   * Outside, so the eyes read as one straight column whatever the depth or the length of a name.
   * On the RIGHT, and it took three passes to get there: pinned on the LEFT it pushed the chevron,
   * the indent and every name of the panel across by its own width plus a gutter, which is the
   * one thing those panels had too much of. What is on the left of an outliner is the shape of
   * the tree; what is on the right is what one does to a row.
   *
   * The tree holds the column open at one width for every row, so a row with nothing to put in
   * it answers `null` rather than spacing itself: the scene's synthetic root does exactly that,
   * standing for a scene, which cannot be hidden.
   *
   * Absent altogether, the row is exactly its indent, its chevron and `renderRow`.
   */
  renderTrailing?: (row: TreeRow<T>) => ReactNode
}

/** One step of indentation. A gauge rather than a pixel count — see `index.css`. */
const INDENT = 'var(--sc-indent)'

/**
 * The pinned column at the right edge, at the gauge of the control it holds — the visibility eye,
 * and nothing wider so far. Held by the tree rather than measured from what the caller returns,
 * because a row that puts nothing in it still has to line the rows under it up.
 */
const PINNED = 'flex w-(--sc-control-inline) shrink-0 justify-center'

/**
 * A tree that does not know what it shows. It owns the geometry — indent, chevron, selection,
 * keyboard — and nothing else, so the scene outliner and a file browser can share it.
 */
export function Tree<T extends TreeNode>({
  nodes,
  label,
  selectedIds,
  expandedIds,
  onSelect,
  onToggle,
  selectable,
  expandable,
  onDrop,
  onInsert,
  draggable,
  dragMultiple = false,
  onDropRoot,
  onContextMenuRoot,
  onDragStart,
  droppable,
  foreign,
  onActivate,
  onContextMenu,
  renderRow,
  renderTrailing,
}: TreeProps<T>) {
  // Which row the pointer is over during a drag, where in it, and what is being dragged. Session
  // state of the gesture itself, so none of it reaches the caller: what the caller hears about
  // is the drop.
  const [over, setOver] = useState<{ id: string; zone: DropZone } | null>(null)
  /**
   * What the hand is holding, the row it took hold of FIRST — which is also what the ghost
   * shows and what the insertion arithmetic runs on.
   *
   * The batch is settled here, when the drag starts, and read on every hover. It cannot be read
   * off the payload: `getData` answers nothing until the drop itself, by design of the platform,
   * so a target asked while the pointer is over it has no other way to know what is coming.
   */
  const [dragged, setDragged] = useState<readonly T[] | null>(null)
  /** The row the gesture started on. The ghost shows it, and the index arithmetic runs on it. */
  const held = dragged?.[0] ?? null
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useMemo(
    () => flattenTree(nodes, expandedIds, expandable),
    [nodes, expandedIds, expandable],
  )

  /**
   * Which folder the pointer rests IN, mid-drag. A primitive and not `over` itself: `onDragOver`
   * sets a fresh object on every tick, so an effect keyed on the object would rearm for ever and
   * never fire once.
   */
  const restingIn = over?.zone === 'into' ? over.id : null

  /**
   * A folder hovered long enough opens itself, so something can be carried two levels down without
   * letting go. The cleanup IS the three cancellations — another row, the drop, the end of the
   * drag. Nothing ever folds back up: a tree that did would move under a hand still holding.
   */
  useEffect(() => {
    if (restingIn === null) return
    // A folder nobody has opened counts: opening it is what READS it, in a tree that loads lazily.
    const row = rows.find(one => one.node.id === restingIn)
    if (!row?.hasChildren || row.expanded) return

    const timer = setTimeout(() => onToggle(restingIn), HOVER_EXPAND_MS)
    return () => clearTimeout(timer)
  }, [restingIn, rows, onToggle])

  /**
   * Where the ghost sits, and what it shows: the row being dragged, at the depth of the level
   * that would receive it — which is the whole of what says "this leaves the group" from "this
   * moves inside it".
   *
   * One row, even for a group carrying twenty: a gap that grew with the subtree would resize the
   * list under the pointer on every hover.
   */
  const ghost = useMemo(() => {
    if (held === null || over === null || over.zone === 'into') return null

    const at = rows.findIndex(row => row.node.id === over.id)
    const target = rows[at]
    const moved = rows.find(row => row.node.id === held.id)
    if (!target || !moved) return null

    // After a row means after everything it holds: an insertion beside a group belongs below its
    // last visible descendant, not between the group and its first child.
    let index = at
    if (over.zone === 'after') {
      index += 1
      while (index < rows.length && (rows[index]?.depth ?? 0) > target.depth) index += 1
    }

    return { index, row: { ...moved, depth: target.depth } }
  }, [rows, over, held])

  /**
   * The rows on screen, with the gap the ghost sits in while a drop is being aimed. Inserted
   * into the list rather than drawn over it: the virtualizer counts one row more and opens the
   * gap on its own, where shifting every offset by hand would be the same arithmetic written
   * twice — once for the geometry, once for the scroll height.
   *
   * The row being dragged STAYS where it is, dimmed. Taking it out would remount the element
   * the pointer is holding, and a drag whose source is unmounted mid-gesture stops firing.
   */
  const slots = useMemo(() => {
    const placed = rows.map(row => ({ row, ghost: false }))
    if (ghost === null) return placed

    placed.splice(ghost.index, 0, { row: ghost.row, ghost: true })
    return placed
  }, [rows, ghost])

  // Read back from the gauge the row below is sized by: a constant is only right at one density.
  //
  // A control's, for every tree in the studio and with no way to ask for another: the explorer was
  // the one that stacked a second line, and it stopped on 2026-08-14 — a whole panel measured for
  // a word one row in thirty carried. A tree is a list of NAMES. `Collection` still takes the
  // taller shapes, for the surfaces that really do stack.
  const rowPixels = useRowHeight('control')

  // Virtualized like `Collection`: a scene of a few hundred nodes is a few thousand elements,
  // and every one of them would be reconciled on each selection click.
  const virtualizer = useVirtualizer({
    count: slots.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowPixels,
    overscan: 8,
  })

  // The virtualizer memoizes on `count`, never on the estimator: without this the rows keep the
  // height the previous density gave them.
  useRemeasure(virtualizer, rowPixels)

  const focusRow = (index: number): void => {
    const bounded = Math.max(0, Math.min(index, slots.length - 1))
    virtualizer.scrollToIndex(bounded)

    const focus = (): void => {
      scroller.current?.querySelector<HTMLElement>(`[data-row="${bounded}"]`)?.focus()
    }
    // Twice: the row is already mounted in the common case, and only a scroll that revealed a
    // new one needs the frame the virtualizer takes to render it.
    focus()
    requestAnimationFrame(focus)
  }

  const selected = new Set(selectedIds)
  const anchor = selectedIds.at(-1)

  // Roving tab stop: one entry into the tree, then the arrows. Every row reachable by tab
  // would make a scene of two hundred nodes two hundred presses deep.
  //
  // Counted over the slots, like every index the rows carry: a ghost sitting above the anchor
  // shifts what `data-row` numbers, and the tab stop would land on its neighbour.
  const tabStop = Math.max(
    0,
    slots.findIndex(slot => !slot.ghost && slot.row.node.id === anchor),
  )

  // A row that a selection may not hold is not a node either: it has nothing to move.
  const canDrag = (node: T): boolean =>
    (onDrop !== undefined || onInsert !== undefined) &&
    (selectable?.(node) ?? true) &&
    (draggable?.(node) ?? true)

  const parentById = useMemo(() => new Map(nodes.map(node => [node.id, node.parentId])), [nodes])

  /**
   * What taking hold of `node` picks up: the whole selection where the caller asked for it and
   * the row is part of it, that row alone everywhere else.
   *
   * The row taken hold of comes FIRST, whatever its place in the selection: the ghost shows it,
   * and it is the one the pointer is actually over.
   */
  const batchFrom = (node: T): readonly T[] => {
    if (!dragMultiple || !selected.has(node.id)) return [node]

    const rest = rows
      .map(row => row.node)
      .filter(one => one.id !== node.id && selected.has(one.id) && canDrag(one))
    return [node, ...rest]
  }

  /**
   * Whether `id` sits anywhere under `ancestorId` — the whole chain, not just one step. Bounded
   * by the node count rather than by reaching a root: a tree whose data holds a cycle would
   * otherwise hang the window instead of refusing one drop.
   *
   * The engines refuse the same loop on their own — `canReparent` in `scene-state`, `moveLayer`
   * in the canvas commands — and deliberately: this one keeps the gesture from being OFFERED,
   * theirs keep a command arriving from anywhere else from closing the tree on itself.
   */
  const under = (ancestorId: string, id: string | null): boolean => {
    let current = id
    for (let step = 0; current !== null && step <= parentById.size; step += 1) {
      if (current === ancestorId) return true
      current = parentById.get(current) ?? null
    }
    return false
  }

  // A row receives neither itself nor anything it holds, whatever the caller answers: those two
  // belong to the tree, and a subtree dropped into itself leaves the document with no way back.
  // Every member of the batch is asked, so one bad member refuses the whole outline rather than
  // letting a drop through that would take the destination with it.
  const accepts = (node: T): boolean =>
    dragged !== null &&
    dragged.every(one => !under(one.id, node.id)) &&
    (droppable?.(node, dragged) ?? true)

  /**
   * Where a drop beside `row` would land, or `null` for a gesture with nothing to do: dropping a
   * node back where it already sits, and dropping a subtree into itself — which would take the
   * receiving level along with the moved node and leave every row under it out of the tree.
   *
   * The index counts the level once the moved node has LEFT it, so moving a row further down
   * its own level shifts by one. Every caller would have to redo this, and the studio would
   * carry as many versions of it as it has trees.
   */
  const insertionAt = (
    row: TreeRow<T>,
    side: 'before' | 'after',
  ): { parentId: string | null; index: number } | null => {
    if (!held || !dragged || dragged.some(one => under(one.id, row.node.parentId))) return null

    const at = side === 'before' ? row.position - 1 : row.position
    // Counted on the row the hand took hold of. An insertion is arithmetic written for ONE row
    // leaving its level, which is why `dragMultiple` is off wherever `onInsert` is used.
    const from =
      held.parentId === row.node.parentId
        ? (rows.find(candidate => candidate.node.id === held.id)?.position ?? 0) - 1
        : null

    if (from === null) return { parentId: row.node.parentId, index: at }
    const index = from < at ? at - 1 : at
    return index === from ? null : { parentId: row.node.parentId, index }
  }

  /**
   * What releasing here would do, resolved once: the hover reads its zone to draw, and the drop
   * reads the same answer to report. Two passes would be two chances to disagree, over a row
   * whose thirds the pointer is sitting exactly on the edge of.
   */
  const dropTargetFor = (
    row: TreeRow<T>,
    event: React.DragEvent<HTMLElement>,
  ): DropTarget | null => {
    const into = onDrop !== undefined && accepts(row.node)
    if (onInsert === undefined) return into ? { zone: 'into' } : null

    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - box.top) / box.height
    // A third each where the middle receives, half and half where it cannot: a third of a row
    // that nothing lands in is a third of a row the hand keeps missing.
    const edge = into ? 1 / 3 : 1 / 2
    const side = ratio < edge ? 'before' : ratio >= 1 - edge ? 'after' : null
    if (side === null) return into ? { zone: 'into' } : null

    const insertion = insertionAt(row, side)
    return insertion === null ? null : { zone: side, ...insertion }
  }

  const pick = (node: T, modifiers: Modifiers): void => {
    // An unselectable row selects nothing rather than itself — clicking a header clears.
    if (selectable && !selectable(node)) return onSelect([], 'replace')

    const reachable = rows.map(row => row.node).filter(candidate => selectable?.(candidate) ?? true)
    const { ids, mode } = pickFrom(
      reachable.map(candidate => candidate.id),
      anchor,
      node.id,
      modifiers,
    )
    onSelect(ids, mode)
  }

  /**
   * What sits inside a row: the pinned column, then everything the depth moves.
   *
   * Written once for the real row and for the GHOST — the outline that follows the pointer during
   * a drag. The two carry the same four pieces of geometry, and the ghost's whole job is to line
   * up with the rows under it: a copy of them would be a copy that says where a drop lands.
   *
   * `ghost` turns off what a row that does not exist yet cannot have — a control for a state
   * nothing is in, a chevron folding a branch nobody made. `invisible` rather than an empty span,
   * so the column keeps the width the caller's control gives it, and rather than `opacity-0`,
   * which would leave a button in the tab order.
   */
  const body = (row: TreeRow<T>, ghost: boolean): ReactNode => (
    <>
      <div
        style={{ paddingLeft: `calc(${INDENT} * ${row.depth})` }}
        className="flex h-full min-w-0 flex-1 items-center"
      >
        {/* The fold column is kept open on a leaf, and it is NOT a cosmetic choice: it is what
            makes the indent arithmetic uniform. A parent's content starts one column past its own
            edge, so a child starts one INDENT past its parent's edge — the two only read as
            nested while every row pays the same column.

            Closing it on leaves was tried on 2026-08-14 and reverted the same day: `--sc-indent`
            is 12px and this column is 12px, so a layer inside a group landed at exactly its
            parent's x — and 4px to its LEFT in compact density, where the indent drops to 8. The
            nesting a stack panel exists to show simply disappeared. Giving it back would mean an
            indent of a column plus a gutter, which is 24px a level, and the file browser next
            door would then walk in strides.

            Not a control: the row carries `aria-expanded` and the arrows already toggle it. Named
            because it has no other handle, being `aria-hidden` — three suites used to reach it as
            the row's `firstChild`, a claim about the markup around it rather than about it. */}
        <span
          aria-hidden="true"
          data-chevron
          className="flex w-3 shrink-0 justify-center"
          onPointerDown={event => {
            if (ghost || !row.hasChildren) return
            // The row selects on pointer down, which fires before click: stopping the click
            // alone would still have let the chevron steal the selection.
            event.stopPropagation()
            onToggle(row.node.id)
          }}
        >
          {!ghost && row.hasChildren && (
            <UiIcon path={row.expanded ? mdiChevronDown : mdiChevronRight} size={12} />
          )}
        </span>
        {renderRow(row)}
      </div>
      {renderTrailing && (
        <span className={cn(PINNED, ghost && 'invisible')}>{renderTrailing(row)}</span>
      )}
    </>
  )

  // The React event, not `event.nativeEvent`: React dispatches from a single root listener, so
  // the native event's `currentTarget` is already null by the time a handler reads it — and the
  // guard below then refused every `Enter` and every `Space`, in every tree of the studio.
  const onRowKeyDown = (
    row: TreeRow<T>,
    index: number,
    event: React.KeyboardEvent<HTMLElement>,
  ): void => {
    if (event.key === 'ArrowRight' && row.hasChildren && !row.expanded) onToggle(row.node.id)
    else if (event.key === 'ArrowLeft' && row.expanded) onToggle(row.node.id)
    else if (event.key === 'ArrowDown') focusRow(Math.min(index + 1, slots.length - 1))
    else if (event.key === 'ArrowUp') focusRow(Math.max(index - 1, 0))
    else if (event.key === 'Enter' || event.key === ' ') {
      // Only when the row itself holds the focus, the guard `Collection` already carries: a
      // control inside the row — the visibility eye — answers the key on its own, and
      // `VisibilityToggle` can stop a click but never a key press.
      if (event.target !== event.currentTarget) return
      // `Enter` opens where there is something to open, and picks where there is not. `Space`
      // always picks: a key that opened a document from an outliner and selected a node from a
      // file browser would be the same key meaning two things.
      if (event.key === 'Enter' && onActivate) onActivate(row.node)
      else pick(row.node, event)
    } else return

    event.preventDefault()
  }

  return (
    // `p-2`, and it moves with `Collection`'s: the same row has to sit at the same distance
    // from the panel edge whichever of the two is holding it.
    <div
      ref={scroller}
      className="h-full overflow-auto p-2"
      /**
       * A press on the blank below the rows clears the selection, as every file browser does.
       *
       * Not cosmetic: what a gesture applies to is the selection, and where it LANDS is read
       * off the picked row. With no way to pick nothing, a panel whose rows are all folders the
       * studio owns could not aim at the project folder at all — measured on screen, in a
       * project holding only `assets/` and `documents/`, where « Nouveau dossier » was refused
       * wherever one clicked.
       */
      onPointerDown={event => {
        if (event.target === event.currentTarget) onSelect([], 'replace')
      }}
      // Same blank, same aim as the drop below. The selection is cleared first for the same
      // reason the press above clears it: what the menu offers lands on what is picked, and the
      // blank means nothing is.
      onContextMenu={event => {
        if (!onContextMenuRoot || event.target !== event.currentTarget) return
        event.preventDefault()
        onSelect([], 'replace')
        onContextMenuRoot()
      }}
      // Only the blank BELOW the rows: the list is as tall as its rows, so anything over one of
      // them has the row as its target and is that row's business. Without this test the whole
      // panel would answer for every hover, outline included.
      onDragOver={event => {
        if (event.target !== event.currentTarget) return
        if (foreign?.carries(event)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          return setOver(null)
        }
        if (!onDropRoot || !rowDrag.carries(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(null)
      }}
      onDrop={event => {
        if (event.target !== event.currentTarget) return
        if (foreign?.carries(event)) {
          event.preventDefault()
          setOver(null)
          return foreign.onDrop(event, null)
        }
        if (!onDropRoot) return
        event.preventDefault()
        setOver(null)
        setDragged(null)
        const carried = rowDrag.idsFrom(event)
        if (carried.length > 0) onDropRoot(carried)
      }}
    >
      <ul
        role="tree"
        aria-label={label}
        style={{ height: virtualizer.getTotalSize() }}
        className="relative"
      >
        {virtualizer.getVirtualItems().map(virtual => {
          const slot = slots[virtual.index]
          if (!slot) return null
          const { row } = slot
          const index = virtual.index

          /**
           * The ghost: the row as it would read once dropped, at the depth of its new level.
           * Announced to nobody — it stands for a move that has not happened, and a reader
           * walking the tree would count a layer the document does not have.
           */
          if (slot.ghost)
            return (
              <li
                key={`ghost:${row.node.id}`}
                role="presentation"
                aria-hidden="true"
                style={{ transform: `translateY(${virtual.start}px)`, height: virtual.size }}
                className="pointer-events-none absolute inset-x-0 top-0 py-px"
              >
                <div
                  className={cn(
                    ROW_LINE,
                    'border-accent bg-elevated rounded-(--radius-sc-sm) border border-dashed',
                  )}
                >
                  {body(row, true)}
                </div>
              </li>
            )

          return (
            <li
              key={row.node.id}
              // The virtualizer's row is geometry, not structure: a generic element between a
              // `tree` and its `treeitem`s breaks the ownership ARIA requires — the same reason
              // `Collection` gives for its own.
              role="presentation"
              style={{
                transform: `translateY(${virtual.start}px)`,
                height: virtual.size,
              }}
              // A hairline above and below the fill, taken off the slot rather than added to it, so
              // the row count on screen does not change: without it two picked rows meet fill to
              // fill and read as one taller block with rounded ends, which is what a run of them
              // looked like in the layer stack.
              className="absolute inset-x-0 top-0 py-px"
            >
              <div
                role="treeitem"
                data-row={index}
                tabIndex={index === tabStop ? 0 : -1}
                aria-selected={selected.has(row.node.id)}
                // What `rowSkin`'s group reads, and not the ARIA above: the explorer paints what
                // is OPEN through the same skin, where announcing "selected" would be a lie.
                data-selected={selected.has(row.node.id) || undefined}
                aria-expanded={row.hasChildren ? row.expanded : undefined}
                // The tree is flattened and virtualized, so the DOM conveys neither nesting nor
                // how many rows there are: depth is a `paddingLeft` and only a window is mounted.
                // Said in words, or a reader announces a folder and what it holds as equals.
                aria-level={row.depth + 1}
                aria-posinset={row.position}
                aria-setsize={row.siblings}
                className={cn(
                  ROW_LINE,
                  'group cursor-pointer',
                  // A list row does not answer the pointer — see `rowSkin`. What says where the
                  // pointer is in a tree is the pointer.
                  rowSkin(selected.has(row.node.id), { surface: 'row' }),
                  // The row a drop would land in, told apart from the row that is selected.
                  over?.id === row.node.id &&
                    over.zone === 'into' &&
                    'outline-accent outline -outline-offset-1',
                  // The rows the hand is holding, while the ghost shows where they would land. A
                  // dimming rather than a hidden row: taking one out would remount the element
                  // the pointer is dragging, and the gesture would stop firing there and then.
                  ghost !== null && dragged?.some(one => one.id === row.node.id) && 'opacity-40',
                )}
                // The handle is the row itself — a `draggable` makes every control inside it
                // draggable too, so the eye would reparent instead of toggling.
                draggable={canDrag(row.node)}
                onDragStart={event => {
                  if (event.target !== event.currentTarget) return event.preventDefault()
                  const batch = batchFrom(row.node)
                  rowDrag.start(
                    event,
                    batch.map(one => one.id),
                  )
                  // After the tree's own channel, so a row can be BOTH: a document moved within
                  // the folder, and the same document laid on a montage. The two are told apart
                  // by the type each target asks for, never by which one was announced first.
                  onDragStart?.(row.node, event)
                  setDragged(batch)
                }}
                onDragOver={event => {
                  // A drag from elsewhere only ever lands INSIDE a row, so it takes the same
                  // outline and the same spring-loaded open — `restingIn` reads `into`.
                  if (foreign?.carries(event)) {
                    if (!foreign.accepts(row.node)) return
                    event.preventDefault()
                    // What leaves the shelf is COPIED into the folder, never taken from it.
                    event.dataTransfer.dropEffect = 'copy'
                    return setOver({ id: row.node.id, zone: 'into' })
                  }
                  if (!rowDrag.carries(event)) return
                  const target = dropTargetFor(row, event)
                  if (target === null) {
                    return setOver(current => (current?.id === row.node.id ? null : current))
                  }
                  // Without this the browser refuses the drop, and neither callback ever fires.
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setOver({ id: row.node.id, zone: target.zone })
                }}
                onDragLeave={() =>
                  setOver(current => (current?.id === row.node.id ? null : current))
                }
                onDragEnd={() => {
                  setOver(null)
                  setDragged(null)
                }}
                onDrop={event => {
                  event.preventDefault()
                  // Before the tree's own reading: `dragged` is null for this one, and every
                  // check below would refuse it on that alone.
                  if (foreign?.carries(event)) {
                    setOver(null)
                    if (foreign.accepts(row.node)) foreign.onDrop(event, row.node)
                    return
                  }
                  const target = dropTargetFor(row, event)
                  setOver(null)

                  /**
                   * The payload decides, not what this tree remembers picking up. `dragged`
                   * survives a gesture that ended without either callback — a drag cancelled
                   * after its source row scrolled out of the window fires no `dragEnd` — and
                   * the channel is shared by every tree, so the next drag started ANYWHERE
                   * would otherwise be reported here as this tree's stale nodes.
                   *
                   * The head of the list is what is compared: it is the row the gesture started
                   * on, and no two trees can be holding the same one.
                   */
                  const carried = rowDrag.idsFrom(event)
                  if (held && target !== null && carried[0] === held.id) {
                    if (target.zone === 'into') onDrop?.(carried, row.node.id)
                    else onInsert?.(carried, target.parentId, target.index)
                  }
                  // Cleared here as well as on `dragEnd`: the source row is virtualized, so a
                  // drag that scrolled it out of view has no element left to end on.
                  setDragged(null)
                }}
                // The secondary button is left to `onContextMenu` below, which aims rather than
                // composes: on macOS it arrives as Ctrl+click, and `pickFrom` reads that modifier
                // as a toggle — the row a menu was raised on left the very selection the menu was
                // about to act on.
                onPointerDown={event => event.button !== 2 && pick(row.node, event)}
                // A double-click inside a row's rename field is someone selecting a word, not
                // asking for the row: activating it here opened the document being renamed —
                // which, in the explorer, then greyed "Rename" out and cancelled the gesture.
                // Same reading as the right-click below, and the same reason.
                onDoubleClick={event => !isTyping(event.target) && onActivate?.(row.node)}
                onContextMenu={event => {
                  // A right-click in a row's rename field belongs to the native clipboard and
                  // spelling menu (`main/window/contextMenu.ts`), which `preventDefault` would
                  // keep from ever being asked.
                  if (!onContextMenu || isTyping(event.target)) return
                  event.preventDefault()
                  // Aimed, never composed: a row already in the selection keeps it whole — what
                  // every file browser does, and what a menu acting on a selection needs. It is
                  // also the only arming a menu raised from the KEYBOARD ever gets: `Shift+F10`
                  // fires this with no pointer event before it.
                  if (!selectedIds.includes(row.node.id)) pick(row.node, NO_MODIFIERS)
                  onContextMenu(row.node)
                }}
                onKeyDown={event => onRowKeyDown(row, index, event)}
              >
                {body(row, false)}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
