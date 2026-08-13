import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { dragChannel } from '@/helpers/drag'
import { pickFrom, type Modifiers, type SelectionMode } from '@/helpers/selection'
import { isTyping } from '@/helpers/typing'
import { rowSkin } from './styles'
import { UiIcon } from './UiIcon'
import { useRemeasure, useRowHeight, type RowHeight } from './virtual'

export type TreeNode = { id: string; parentId: string | null }

const ROWS = dragChannel('application/x-scenario-tree-row')

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
  onContextMenu?: (node: T, at: { x: number; y: number }) => void
  /**
   * A row was dropped onto another. Absent leaves the tree undraggable — a tree with nothing to
   * reorder that offered the gesture would promise something it cannot do.
   */
  onDrop?: (id: string, parentId: string) => void
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
   * How tall a row is, for a tree whose rows stack a name over a subtitle.
   *
   * `control` by default, which is every tree but the explorer's — and the explorer is what this
   * exists for: its rows carry a second line for a document that is open, and two steps of
   * `leading-tight` text do not fit in a control's height. Same shape as `Collection`'s, resolved
   * by the same hook.
   */
  rowHeight?: RowHeight
}

/** One step of indentation. A gauge rather than a pixel count — see `index.css`. */
const INDENT = 'var(--sc-indent)'

/**
 * A tree that does not know what it shows. It owns the geometry — indent, chevron, selection,
 * keyboard — and nothing else, so the scene outliner and a file browser can share it.
 */
export function Tree<T extends TreeNode>({
  nodes,
  selectedIds,
  expandedIds,
  onSelect,
  onToggle,
  selectable,
  expandable,
  onDrop,
  draggable,
  droppable,
  onActivate,
  onContextMenu,
  renderRow,
  rowHeight = 'control',
}: TreeProps<T>) {
  // Which row the pointer is over during a drag, and what is being dragged. Session state of
  // the gesture itself, so neither reaches the caller: what the caller hears about is the drop.
  const [over, setOver] = useState<string | null>(null)
  const [dragged, setDragged] = useState<T | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useMemo(
    () => flattenTree(nodes, expandedIds, expandable),
    [nodes, expandedIds, expandable],
  )

  // Read back from the gauge the row below is sized by: a constant is only right at one density.
  const rowPixels = useRowHeight(rowHeight)

  // Virtualized like `Collection`: a scene of a few hundred nodes is a few thousand elements,
  // and every one of them would be reconciled on each selection click.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => rowPixels,
    overscan: 8,
  })

  // The virtualizer memoizes on `count`, never on the estimator: without this the rows keep the
  // height the previous density gave them.
  useRemeasure(virtualizer, rowPixels)

  const focusRow = (index: number): void => {
    const bounded = Math.max(0, Math.min(index, rows.length - 1))
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
  const tabStop = Math.max(
    0,
    rows.findIndex(row => row.node.id === anchor),
  )

  // A row that a selection may not hold is not a node either: it has nothing to move.
  const canDrag = (node: T): boolean =>
    onDrop !== undefined && (selectable?.(node) ?? true) && (draggable?.(node) ?? true)

  // A row never receives itself, whatever the caller answers: that one belongs to the tree.
  const accepts = (node: T): boolean =>
    dragged !== null && node.id !== dragged.id && (droppable?.(node, dragged) ?? true)

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
    else if (event.key === 'ArrowDown') focusRow(Math.min(index + 1, rows.length - 1))
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
      <ul role="tree" style={{ height: virtualizer.getTotalSize() }} className="relative">
        {virtualizer.getVirtualItems().map(virtual => {
          const row = rows[virtual.index]
          if (!row) return null
          const index = virtual.index

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
              className="absolute inset-x-0 top-0"
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
                style={{ paddingLeft: `calc(${INDENT} * ${row.depth})` }}
                className={cn(
                  'group flex h-full cursor-pointer items-center gap-2 px-1',
                  rowSkin(selected.has(row.node.id)),
                  // The row a drop would land in, told apart from the row that is selected.
                  over === row.node.id && 'outline-accent outline -outline-offset-1',
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
                  if (!onDrop || !ROWS.carries(event) || !accepts(row.node)) return
                  // Without this the browser refuses the drop, and `onDrop` never fires.
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setOver(row.node.id)
                }}
                onDragLeave={() => setOver(current => (current === row.node.id ? null : current))}
                onDragEnd={() => {
                  setOver(null)
                  setDragged(null)
                }}
                onDrop={event => {
                  event.preventDefault()
                  setOver(null)
                  if (dragged && accepts(row.node)) onDrop?.(dragged.id, row.node.id)
                  // Cleared here as well as on `dragEnd`: the source row is virtualized, so a
                  // drag that scrolled it out of view has no element left to end on.
                  setDragged(null)
                }}
                onPointerDown={event => pick(row.node, event)}
                onDoubleClick={() => onActivate?.(row.node)}
                onContextMenu={event => {
                  // A right-click in a row's rename field belongs to the native clipboard and
                  // spelling menu (`main/window/context-menu.ts`), which `preventDefault` would
                  // keep from ever being asked.
                  if (!onContextMenu || isTyping(event.target)) return
                  event.preventDefault()
                  onContextMenu(row.node, { x: event.clientX, y: event.clientY })
                }}
                onKeyDown={event => onRowKeyDown(row, index, event)}
              >
                {/* The chevron keeps its column even on a leaf: rows whose content shifts by a
                glyph are unreadable as a list. It is not a control — the row already carries
                `aria-expanded`, and the arrows already toggle it. */}
                <span
                  aria-hidden="true"
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
