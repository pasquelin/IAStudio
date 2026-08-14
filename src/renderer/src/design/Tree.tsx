import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { dragChannel } from '@/helpers/drag'
import { pickFrom, type Modifiers, type SelectionMode } from '@/helpers/selection'
import { isTyping } from '@/helpers/typing'
import { rowSkin } from './styles'
import { UiIcon } from './UiIcon'
import { useRemeasure, useRowHeight } from './virtual'

export type TreeNode = { id: string; parentId: string | null }

const ROWS = dragChannel('application/x-scenario-tree-row')

/** A pick that composes with nothing — what aiming a menu at a row asks for. */
const NO_MODIFIERS: Modifiers = { shiftKey: false, metaKey: false, ctrlKey: false }

/** Where in a row the pointer is: its edges insert beside it, its middle drops into it. */
type DropZone = 'before' | 'into' | 'after'

/** What releasing over a row would do. An insertion carries where it would land. */
type DropTarget =
  { zone: 'into' } | { zone: 'before' | 'after'; parentId: string | null; index: number }

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
  /** A right-click on a row, with where the pointer was. Absent leaves the browser's own menu. */
  /** Takes no coordinates: the system pops the menu where the pointer already is. */
  onContextMenu?: (node: T) => void
  /**
   * A row was dropped onto another. Absent leaves the tree undraggable — a tree with nothing to
   * reorder that offered the gesture would promise something it cannot do — unless `onInsert`
   * is there, which is the other half of the same gesture.
   */
  onDrop?: (id: string, parentId: string) => void
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
  onInsert?: (id: string, parentId: string | null, index: number) => void
  /**
   * Which rows may be picked up. A row that cannot move never becomes draggable, so the refusal
   * is in the hand rather than at the release: a gesture that runs its course and then does
   * nothing is the one outcome worse than no gesture.
   */
  draggable?: (node: T) => boolean
  /**
   * Which rows may receive `dragged`. Refused rows take no outline and no drop, which is why
   * the tree keeps the dragged node rather than reading the drag payload: `getData` answers
   * nothing until the drop itself, so a target asked at hover has no other way to know what is
   * coming. It is also what tells a drag that began in ANOTHER tree — the channel is shared —
   * from one of this tree's own rows.
   */
  droppable?: (node: T, dragged: T) => boolean
  /** Draws the row's content. The tree owns the chevron, the indent and the selection. */
  renderRow: (row: TreeRow<T>) => ReactNode
  /**
   * Draws a column pinned to the LEFT EDGE, outside the indentation — the visibility eye of a
   * layer stack and of the scene outliner.
   *
   * Outside, and that is the whole of what this prop is for: an eye that walked right with the
   * depth put a top-level layer's controls further in than the group's own chevron, which is what
   * a stack panel is read the other way round from. Photoshop has pinned that column for thirty
   * years, and a stack is what the layers panel is — a file browser has no such column and does
   * not pass this.
   *
   * Absent, the row is exactly its indent, its chevron and `renderRow`.
   */
  renderLeading?: (row: TreeRow<T>) => ReactNode
}

/** One step of indentation. A gauge rather than a pixel count — see `index.css`. */
const INDENT = 'var(--sc-indent)'

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
  droppable,
  onActivate,
  onContextMenu,
  renderRow,
  renderLeading,
}: TreeProps<T>) {
  // Which row the pointer is over during a drag, where in it, and what is being dragged. Session
  // state of the gesture itself, so none of it reaches the caller: what the caller hears about
  // is the drop.
  const [over, setOver] = useState<{ id: string; zone: DropZone } | null>(null)
  const [dragged, setDragged] = useState<T | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useMemo(
    () => flattenTree(nodes, expandedIds, expandable),
    [nodes, expandedIds, expandable],
  )

  /**
   * Where the ghost sits, and what it shows: the row being dragged, at the depth of the level
   * that would receive it — which is the whole of what says "this leaves the group" from "this
   * moves inside it".
   *
   * One row, even for a group carrying twenty: a gap that grew with the subtree would resize the
   * list under the pointer on every hover.
   */
  const ghost = useMemo(() => {
    if (dragged === null || over === null || over.zone === 'into') return null

    const at = rows.findIndex(row => row.node.id === over.id)
    const target = rows[at]
    const moved = rows.find(row => row.node.id === dragged.id)
    if (!target || !moved) return null

    // After a row means after everything it holds: an insertion beside a group belongs below its
    // last visible descendant, not between the group and its first child.
    let index = at
    if (over.zone === 'after') {
      index += 1
      while (index < rows.length && (rows[index]?.depth ?? 0) > target.depth) index += 1
    }

    return { index, row: { ...moved, depth: target.depth } }
  }, [rows, over, dragged])

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
  const accepts = (node: T): boolean =>
    dragged !== null && !under(dragged.id, node.id) && (droppable?.(node, dragged) ?? true)

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
    if (!dragged || under(dragged.id, row.node.parentId)) return null

    const at = side === 'before' ? row.position - 1 : row.position
    const from =
      dragged.parentId === row.node.parentId
        ? (rows.find(candidate => candidate.node.id === dragged.id)?.position ?? 0) - 1
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
    <div ref={scroller} className="h-full overflow-auto p-2">
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
                <div className="border-accent bg-elevated flex h-full items-center gap-1.5 rounded-(--radius-sc-sm) border border-dashed px-1">
                  {/* The column is held open rather than drawn: the ghost has to line up with the
                      rows under it, and an eye on a row that does not exist yet is a control for a
                      state nothing is in. `invisible` and not `opacity-0` — it takes the button
                      out of the tab order too. */}
                  {renderLeading && (
                    <span className="invisible shrink-0">{renderLeading(row)}</span>
                  )}
                  <div
                    style={{ paddingLeft: `calc(${INDENT} * ${row.depth})` }}
                    className="flex h-full min-w-0 flex-1 items-center gap-1.5"
                  >
                    <span className="flex w-3.5 shrink-0 justify-center" />
                    {renderRow(row)}
                  </div>
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
                  'group flex h-full cursor-pointer items-center gap-1.5 px-1',
                  // A list row does not answer the pointer — see `rowSkin`. What says where the
                  // pointer is in a tree is the pointer.
                  rowSkin(selected.has(row.node.id), false, 'soft', false),
                  // The row a drop would land in, told apart from the row that is selected.
                  over?.id === row.node.id &&
                    over.zone === 'into' &&
                    'outline-accent outline -outline-offset-1',
                  // The row the hand is holding, while the ghost shows where it would land. A
                  // dimming rather than a hidden row: taking it out would remount the element
                  // the pointer is dragging, and the gesture would stop firing there and then.
                  ghost !== null && dragged?.id === row.node.id && 'opacity-40',
                )}
                // The handle is the row itself — a `draggable` makes every control inside it
                // draggable too, so the eye would reparent instead of toggling.
                draggable={canDrag(row.node)}
                onDragStart={event => {
                  if (event.target !== event.currentTarget) return event.preventDefault()
                  ROWS.start(event, row.node.id)
                  setDragged(row.node)
                }}
                onDragOver={event => {
                  if (!ROWS.carries(event)) return
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
                  const target = dropTargetFor(row, event)
                  setOver(null)

                  /**
                   * The payload decides, not what this tree remembers picking up. `dragged`
                   * survives a gesture that ended without either callback — a drag cancelled
                   * after its source row scrolled out of the window fires no `dragEnd` — and
                   * the channel is shared by every tree, so the next drag started ANYWHERE
                   * would otherwise be reported here as this tree's stale node.
                   */
                  if (dragged && target !== null && ROWS.idFrom(event) === dragged.id) {
                    if (target.zone === 'into') onDrop?.(dragged.id, row.node.id)
                    else onInsert?.(dragged.id, target.parentId, target.index)
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
                onDoubleClick={() => onActivate?.(row.node)}
                onContextMenu={event => {
                  // A right-click in a row's rename field belongs to the native clipboard and
                  // spelling menu (`main/window/context-menu.ts`), which `preventDefault` would
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
                {renderLeading?.(row)}
                {/* Everything the depth moves. The pinned column above stays out of it — that is
                    what pins it — and the indent sits here rather than on the row so the fill
                    still runs the whole width at every level. */}
                <div
                  style={{ paddingLeft: `calc(${INDENT} * ${row.depth})` }}
                  className="flex h-full min-w-0 flex-1 items-center gap-1.5"
                >
                  {/* The chevron keeps its column even on a leaf: rows whose content shifts by a
                  glyph are unreadable as a list. It is not a control — the row already carries
                  `aria-expanded`, and the arrows already toggle it. */}
                  <span
                    aria-hidden="true"
                    // Named because it has no other handle: it is `aria-hidden`, so nothing can
                    // ask for it by role or by text. Three suites used to reach it as the row's
                    // `firstChild`, which is a claim about the markup around it rather than
                    // about it — and the claim broke the day the indent moved one element in.
                    data-chevron
                    className="flex w-3.5 shrink-0 justify-center"
                    onPointerDown={event => {
                      if (!row.hasChildren) return
                      // The row selects on pointer down, which fires before click: stopping the
                      // click alone would still have let the chevron steal the selection.
                      event.stopPropagation()
                      onToggle(row.node.id)
                    }}
                  >
                    {row.hasChildren && (
                      <UiIcon path={row.expanded ? mdiChevronDown : mdiChevronRight} size={12} />
                    )}
                  </span>
                  {renderRow(row)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
