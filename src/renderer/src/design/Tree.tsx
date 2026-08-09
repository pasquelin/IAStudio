import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { dragChannel } from '@/helpers/drag'
import { pickFrom, type Modifiers, type SelectionMode } from '@/helpers/selection'
import { LIST_ROW_HEIGHT, rowSkin } from './styles'
import { UiIcon } from './UiIcon'

export type TreeNode = { id: string; parentId: string | null }

const ROWS = dragChannel('application/x-scenario-tree-row')

export type TreeRow<T> = { node: T; depth: number; hasChildren: boolean; expanded: boolean }

/**
 * Flattens the tree into the rows actually on screen. A node whose parent is missing is dropped
 * rather than promoted to a root: silently reparenting an orphan hides the bug that produced it.
 */
export function flattenTree<T extends TreeNode>(
  nodes: readonly T[],
  expandedIds: ReadonlySet<string>,
): TreeRow<T>[] {
  const byParent = new Map<string | null, T[]>()
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId)
    if (siblings) siblings.push(node)
    else byParent.set(node.parentId, [node])
  }

  const rows: TreeRow<T>[] = []
  const walk = (parentId: string | null, depth: number): void => {
    for (const node of byParent.get(parentId) ?? []) {
      const hasChildren = byParent.has(node.id)
      const expanded = expandedIds.has(node.id)
      rows.push({ node, depth, hasChildren, expanded })
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
   * A row was dropped onto another. Absent leaves the tree undraggable — a file browser has
   * nothing to reorder, and offering the gesture there would promise something it cannot do.
   */
  onDrop?: (id: string, parentId: string) => void
  /** Draws the row's content. The tree owns the chevron, the indent and the selection. */
  renderRow: (row: TreeRow<T>) => ReactNode
}

const INDENT = 12

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
  onDrop,
  renderRow,
}: TreeProps<T>) {
  // Which row the pointer is over during a drag. Session state of the gesture itself, so it
  // never reaches the caller: what the caller hears about is the drop.
  const [over, setOver] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => flattenTree(nodes, expandedIds), [nodes, expandedIds])

  // Virtualized like `Collection`: a scene of a few hundred nodes is a few thousand elements,
  // and every one of them would be reconciled on each selection click.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => LIST_ROW_HEIGHT,
    overscan: 8,
  })

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

  const onRowKeyDown = (row: TreeRow<T>, index: number, event: KeyboardEvent): void => {
    if (event.key === 'ArrowRight' && row.hasChildren && !row.expanded) onToggle(row.node.id)
    else if (event.key === 'ArrowLeft' && row.expanded) onToggle(row.node.id)
    else if (event.key === 'ArrowDown') focusRow(Math.min(index + 1, rows.length - 1))
    else if (event.key === 'ArrowUp') focusRow(Math.max(index - 1, 0))
    else if (event.key === 'Enter' || event.key === ' ') {
      // Only when the row itself holds the focus, the guard `Collection` already carries: a
      // control inside the row — the visibility eye — answers the key on its own, and
      // `VisibilityToggle` can stop a click but never a key press.
      if (event.target !== event.currentTarget) return
      pick(row.node, event)
    } else return

    event.preventDefault()
  }

  return (
    <div ref={scroller} className="h-full overflow-auto p-1">
      <ul role="tree" style={{ height: virtualizer.getTotalSize() }} className="relative">
        {virtualizer.getVirtualItems().map(virtual => {
          const row = rows[virtual.index]
          if (!row) return null
          const index = virtual.index

          return (
            <li
              key={row.node.id}
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
                aria-expanded={row.hasChildren ? row.expanded : undefined}
                style={{ paddingLeft: row.depth * INDENT }}
                className={cn(
                  'group flex h-(--sc-control) cursor-pointer items-center gap-2 px-1',
                  rowSkin(selected.has(row.node.id)),
                  // The row a drop would land in, told apart from the row that is selected.
                  over === row.node.id && 'outline-accent outline -outline-offset-1',
                )}
                // A row that a selection may not hold is not a node either: it has nothing to
                // move. And the handle is the row itself — a `draggable` makes every control
                // inside it draggable too, so the eye would reparent instead of toggling.
                draggable={onDrop !== undefined && (selectable?.(row.node) ?? true)}
                onDragStart={event => {
                  if (event.target !== event.currentTarget) return event.preventDefault()
                  ROWS.start(event, row.node.id)
                }}
                onDragOver={event => {
                  if (!onDrop || !ROWS.carries(event)) return
                  // Without this the browser refuses the drop, and `onDrop` never fires.
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setOver(row.node.id)
                }}
                onDragLeave={() => setOver(current => (current === row.node.id ? null : current))}
                onDragEnd={() => setOver(null)}
                onDrop={event => {
                  event.preventDefault()
                  setOver(null)
                  const dragged = ROWS.idFrom(event)
                  if (dragged && dragged !== row.node.id) onDrop?.(dragged, row.node.id)
                }}
                onPointerDown={event => pick(row.node, event)}
                onKeyDown={event => onRowKeyDown(row, index, event.nativeEvent)}
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
