import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useMemo, useRef, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { UiIcon } from './UiIcon'

export type TreeNode = { id: string; parentId: string | null }

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
  selectedId: string | null
  expandedIds: ReadonlySet<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
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
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  renderRow,
}: TreeProps<T>) {
  const list = useRef<HTMLUListElement>(null)
  const rows = useMemo(() => flattenTree(nodes, expandedIds), [nodes, expandedIds])

  // Each row is one `<li>` wrapping one treeitem, so the index is enough — a `querySelectorAll`
  // per arrow press would rescan the subtree at key-autorepeat rate.
  const focusRow = (index: number): void => {
    const item = list.current?.children[index]?.firstElementChild
    if (item instanceof HTMLElement) item.focus()
  }

  // Roving tab stop: one entry into the tree, then the arrows. Every row reachable by tab
  // would make a scene of two hundred nodes two hundred presses deep.
  const tabStop = Math.max(
    0,
    rows.findIndex(row => row.node.id === selectedId),
  )

  const onRowKeyDown = (row: TreeRow<T>, index: number, event: KeyboardEvent): void => {
    if (event.key === 'ArrowRight' && row.hasChildren && !row.expanded) onToggle(row.node.id)
    else if (event.key === 'ArrowLeft' && row.expanded) onToggle(row.node.id)
    else if (event.key === 'ArrowDown') focusRow(Math.min(index + 1, rows.length - 1))
    else if (event.key === 'ArrowUp') focusRow(Math.max(index - 1, 0))
    else if (event.key === 'Enter' || event.key === ' ') onSelect(row.node.id)
    else return

    event.preventDefault()
  }

  return (
    <ul ref={list} role="tree" className="p-1">
      {rows.map((row, index) => (
        <li key={row.node.id}>
          <div
            role="treeitem"
            tabIndex={index === tabStop ? 0 : -1}
            aria-selected={row.node.id === selectedId}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            style={{ paddingLeft: row.depth * INDENT }}
            className={cn(
              'group flex items-center gap-1 rounded-(--radius-sc-md) px-1',
              'h-(--sc-control) cursor-pointer outline-none',
              row.node.id === selectedId ? 'bg-accent-soft' : 'hover:bg-elevated',
              'focus-visible:ring-accent focus-visible:ring-1',
            )}
            onPointerDown={() => onSelect(row.node.id)}
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
      ))}
    </ul>
  )
}
