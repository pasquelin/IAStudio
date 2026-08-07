import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { flattenTree, Tree } from './Tree'

const NODES = [
  { id: 'scene', parentId: null },
  { id: 'a', parentId: 'scene' },
  { id: 'a1', parentId: 'a' },
  { id: 'b', parentId: 'scene' },
]

describe('flattenTree', () => {
  it('lists only what is reachable through expanded parents', () => {
    const rows = flattenTree(NODES, new Set(['scene']))

    expect(rows.map(row => row.node.id)).toEqual(['scene', 'a', 'b'])
  })

  it('reveals a subtree once its parent is expanded', () => {
    const rows = flattenTree(NODES, new Set(['scene', 'a']))

    expect(rows.map(row => row.node.id)).toEqual(['scene', 'a', 'a1', 'b'])
  })

  it('hides everything under a collapsed root', () => {
    expect(flattenTree(NODES, new Set()).map(row => row.node.id)).toEqual(['scene'])
  })

  it('reports depth from the root', () => {
    const rows = flattenTree(NODES, new Set(['scene', 'a']))

    expect(rows.map(row => row.depth)).toEqual([0, 1, 2, 1])
  })

  it('reports which rows have children', () => {
    const rows = flattenTree(NODES, new Set(['scene']))

    expect(rows.map(row => row.hasChildren)).toEqual([true, true, false])
  })

  it('drops a node whose parent does not exist rather than losing it silently', () => {
    expect(flattenTree([{ id: 'orphan', parentId: 'gone' }], new Set(['gone']))).toEqual([])
  })
})

function renderTree(onSelect = (): void => {}, onToggle = (): void => {}) {
  return render(
    <Tree
      nodes={NODES}
      selectedId={null}
      expandedIds={new Set(['scene'])}
      onSelect={onSelect}
      onToggle={onToggle}
      renderRow={row => <span>{row.node.id}</span>}
    />,
  )
}

describe('Tree', () => {
  it('renders one row per visible node', () => {
    renderTree()

    expect(screen.getAllByRole('treeitem')).toHaveLength(3)
  })

  it('reports the clicked node', async () => {
    const onSelect = vi.fn()
    renderTree(onSelect)

    await userEvent.click(screen.getByText('a'))

    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('expands with the right arrow and collapses with the left', async () => {
    const onToggle = vi.fn()
    renderTree(() => {}, onToggle)

    const row = screen.getAllByRole('treeitem')[1]
    row?.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onToggle).toHaveBeenCalledWith('a')

    const root = screen.getAllByRole('treeitem')[0]
    root?.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onToggle).toHaveBeenCalledWith('scene')
  })

  it('walks the rows with the up and down arrows', async () => {
    renderTree()

    screen.getAllByRole('treeitem')[0]?.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getAllByRole('treeitem')[1]).toHaveFocus()

    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getAllByRole('treeitem')[0]).toHaveFocus()
  })

  it('toggles from the chevron without selecting the row underneath', async () => {
    const onSelect = vi.fn()
    const onToggle = vi.fn()
    renderTree(onSelect, onToggle)

    await userEvent.click(screen.getAllByRole('treeitem')[0]?.firstChild as HTMLElement)

    expect(onToggle).toHaveBeenCalledWith('scene')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('leaves a single row reachable by tab, so a long tree is not a tab trap', () => {
    renderTree()

    const reachable = screen.getAllByRole('treeitem').filter(row => row.tabIndex === 0)
    expect(reachable).toHaveLength(1)
  })
})
