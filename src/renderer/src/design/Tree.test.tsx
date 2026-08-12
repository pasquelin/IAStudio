import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshPalette } from '@/engines/core/palette'
import { dragTransfer } from '@/helpers/drag-fixtures'
import type { SelectionMode } from '@/helpers/selection'
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

type Selector = (ids: readonly string[], mode: SelectionMode) => void

function renderTree(
  onSelect: Selector = () => {},
  onToggle = (): void => {},
  selectedIds: readonly string[] = [],
) {
  return render(
    <Tree
      nodes={NODES}
      selectedIds={selectedIds}
      expandedIds={new Set(['scene'])}
      onSelect={onSelect}
      onToggle={onToggle}
      renderRow={row => <span>{row.node.id}</span>}
    />,
  )
}

describe('Tree, the height it estimates', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--sc-control')
    refreshPalette()
  })

  /**
   * The rows are drawn at `h-(--sc-control)`, so a constant estimate is only right at one
   * density. It estimated 28 against a compact row of 24, and the error compounded: by the
   * hundredth row the tree told the virtualizer a position four hundred pixels off.
   */
  it('estimates the gauge its rows are drawn at, not a constant', () => {
    document.documentElement.style.setProperty('--sc-control', '24px')
    refreshPalette()

    renderTree()

    // Three visible rows: `scene` expanded over `a` and `b`.
    expect(screen.getByRole('tree')).toHaveStyle({ height: '72px' })
  })

  it('falls back to the shipped height when no gauge is declared', () => {
    renderTree()

    expect(screen.getByRole('tree')).toHaveStyle({ height: '84px' })
  })
})

describe('Tree', () => {
  it('renders one row per visible node', () => {
    renderTree()

    expect(screen.getAllByRole('treeitem')).toHaveLength(3)
  })

  it('reports the clicked node, replacing whatever was selected', async () => {
    const onSelect = vi.fn()
    renderTree(onSelect)

    await userEvent.click(screen.getByText('a'))

    expect(onSelect).toHaveBeenCalledWith(['a'], 'replace')
  })

  it('toggles the clicked node when the command key is held', async () => {
    const onSelect = vi.fn()
    // One session for the whole gesture: the direct API opens a new one per call, and the held
    // modifier would be released before the click that is supposed to read it.
    const user = userEvent.setup()
    renderTree(onSelect, () => {}, ['scene'])

    await user.keyboard('{Meta>}')
    await user.click(screen.getByText('a'))
    await user.keyboard('{/Meta}')

    expect(onSelect).toHaveBeenCalledWith(['a'], 'toggle')
  })

  // The rows on screen are the tree's own order, and that is what "everything between" means.
  it('extends over the rows between the anchor and the shift-clicked one', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderTree(onSelect, () => {}, ['scene'])

    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('b'))
    await user.keyboard('{/Shift}')

    expect(onSelect).toHaveBeenCalledWith(['scene', 'a', 'b'], 'replace')
  })

  it('steps over the rows a selection may not hold when it extends', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <Tree
        nodes={NODES}
        selectedIds={['scene']}
        expandedIds={new Set(['scene'])}
        onSelect={onSelect}
        onToggle={() => {}}
        selectable={node => node.id !== 'a'}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    await user.keyboard('{Shift>}')
    await user.click(screen.getByText('b'))
    await user.keyboard('{/Shift}')

    expect(onSelect).toHaveBeenCalledWith(['scene', 'b'], 'replace')
  })

  it('selects nothing at all when an unselectable row is clicked', async () => {
    const onSelect = vi.fn()
    render(
      <Tree
        nodes={NODES}
        selectedIds={['b']}
        expandedIds={new Set(['scene'])}
        onSelect={onSelect}
        onToggle={() => {}}
        selectable={node => node.id !== 'scene'}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    await userEvent.click(screen.getByText('scene'))

    expect(onSelect).toHaveBeenCalledWith([], 'replace')
  })

  it('paints every selected row, not only the anchor', () => {
    renderTree(
      () => {},
      () => {},
      ['scene', 'b'],
    )

    const selected = screen
      .getAllByRole('treeitem')
      .filter(row => row.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(2)
  })

  // A pixel count would hold the same indent in both densities, next to a layer stack whose own
  // step is a gauge. The two steps differ — one gutter there, two here — the reading does not.
  it('indents each level by the density gauge rather than a pixel count', () => {
    renderTree()

    const [root, child] = screen.getAllByRole('treeitem')
    // The factor is held too: it is what keeps a comfortable level at the 12 px it always was.
    expect(root?.style.paddingLeft).toContain('var(--sc-indent)')
    expect(child?.style.paddingLeft).toContain('var(--sc-indent)')
    expect(child?.style.paddingLeft).not.toEqual(root?.style.paddingLeft)
  })

  it('leaves the rows undraggable when nothing listens for a drop', () => {
    renderTree()
    expect(screen.getAllByRole('treeitem')[0]).not.toHaveAttribute('draggable', 'true')
  })

  it('reports a row dropped onto another', () => {
    const onDrop = vi.fn()
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={onDrop}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const rows = screen.getAllByRole('treeitem')
    const data = dragTransfer()
    fireEvent.dragStart(rows[1]!, { dataTransfer: data })
    fireEvent.drop(rows[2]!, { dataTransfer: data })

    expect(onDrop).toHaveBeenCalledWith('a', 'b')
  })

  // Dropping a row onto itself is the gesture of someone who changed their mind.
  it('says nothing when a row is dropped onto itself', () => {
    const onDrop = vi.fn()
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={onDrop}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const row = screen.getAllByRole('treeitem')[1]!
    const data = dragTransfer()
    fireEvent.dragStart(row, { dataTransfer: data })
    fireEvent.drop(row, { dataTransfer: data })

    expect(onDrop).not.toHaveBeenCalled()
  })

  it('refuses to pick up a row the caller will not let move', () => {
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={() => {}}
        draggable={node => node.id !== 'a'}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const [, refused, allowed] = screen.getAllByRole('treeitem')
    expect(refused).not.toHaveAttribute('draggable', 'true')
    expect(allowed).toHaveAttribute('draggable', 'true')
  })

  it('drops nothing on a row the caller will not let receive', () => {
    const onDrop = vi.fn()
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={onDrop}
        droppable={node => node.id !== 'b'}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const rows = screen.getAllByRole('treeitem')
    const data = dragTransfer()
    fireEvent.dragStart(rows[1]!, { dataTransfer: data })
    fireEvent.drop(rows[2]!, { dataTransfer: data })

    expect(onDrop).not.toHaveBeenCalled()
  })

  // A row that will not take the drop must not offer to: the refusal belongs in the hand, not
  // at the release, and the outline is the whole of what the hand sees.
  it('draws no landing outline on a row it would refuse', () => {
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={() => {}}
        droppable={node => node.id !== 'b'}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const rows = screen.getAllByRole('treeitem')
    const data = dragTransfer()
    fireEvent.dragStart(rows[1]!, { dataTransfer: data })
    fireEvent.dragOver(rows[2]!, { dataTransfer: data })
    expect(rows[2]!.className).not.toContain('outline-accent')

    fireEvent.dragOver(rows[0]!, { dataTransfer: data })
    expect(screen.getAllByRole('treeitem')[0]!.className).toContain('outline-accent')
  })

  it('tells the caller what is being dragged, so a target can judge the pair', () => {
    const droppable = vi.fn(() => true)
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={() => {}}
        droppable={droppable}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const rows = screen.getAllByRole('treeitem')
    const data = dragTransfer()
    fireEvent.dragStart(rows[1]!, { dataTransfer: data })
    fireEvent.drop(rows[2]!, { dataTransfer: data })

    expect(droppable).toHaveBeenCalledWith(
      { id: 'b', parentId: 'scene' },
      { id: 'a', parentId: 'scene' },
    )
  })

  // The drag channel is shared by every tree of the studio, so `carries` alone would let a
  // scene node be dropped into a file browser and reported as one of its own rows.
  it('ignores a drop whose drag began in another tree', () => {
    const onDrop = vi.fn()
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={onDrop}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const elsewhere = dragTransfer()
    elsewhere.setData('application/x-scenario-tree-row', 'from-another-tree')
    fireEvent.drop(screen.getAllByRole('treeitem')[2]!, { dataTransfer: elsewhere })

    expect(onDrop).not.toHaveBeenCalled()
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

  // A scene of a few hundred nodes is a few thousand elements, reconciled on every click.
  it('renders a window over the rows rather than all of them', () => {
    const many = Array.from({ length: 2000 }, (_, index) => ({
      id: `node_${index}`,
      parentId: null,
    }))
    render(
      <Tree
        nodes={many}
        selectedIds={[]}
        expandedIds={new Set()}
        onSelect={() => {}}
        onToggle={() => {}}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const rendered = screen.getAllByRole('treeitem')
    expect(rendered.length).toBeGreaterThan(0)
    expect(rendered.length).toBeLessThan(200)
  })
})

/**
 * A file browser opens what a row names; an outliner has nothing to open. Both walk the same
 * tree, so the tree asks rather than assumes.
 */
describe('Tree, opening a row', () => {
  const withActivate = (onActivate: (node: { id: string }) => void, onSelect = vi.fn()) =>
    render(
      <Tree
        nodes={NODES}
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={onSelect}
        onToggle={() => {}}
        onActivate={onActivate}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

  it('opens on a double-click', async () => {
    const onActivate = vi.fn()
    withActivate(onActivate)

    await userEvent.dblClick(screen.getByText('a'))

    expect(onActivate).toHaveBeenCalledWith(NODES[1])
  })

  it('opens on Enter', async () => {
    const onActivate = vi.fn()
    withActivate(onActivate)

    screen.getAllByRole('treeitem')[1]?.focus()
    await userEvent.keyboard('{Enter}')

    expect(onActivate).toHaveBeenCalledWith(NODES[1])
  })

  // A key that opened a document from a browser and selected a node from an outliner would be
  // the same key meaning two things.
  it('still picks on Space', async () => {
    const onActivate = vi.fn()
    const onSelect = vi.fn()
    withActivate(onActivate, onSelect)

    screen.getAllByRole('treeitem')[1]?.focus()
    await userEvent.keyboard(' ')

    expect(onActivate).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalled()
  })

  it('picks on Enter when there is nothing to open', async () => {
    const onSelect = vi.fn()
    renderTree(onSelect)

    screen.getAllByRole('treeitem')[1]?.focus()
    await userEvent.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalled()
  })
})

/**
 * A folder nobody has opened has no children LOADED, which is not the same as having none:
 * derived from the nodes, it draws no chevron and can never be opened at all.
 */
describe('Tree, a node that can hold children it has not got yet', () => {
  it('offers to expand what the caller says is expandable', () => {
    render(
      <Tree
        nodes={[{ id: 'assets', parentId: null }]}
        selectedIds={[]}
        expandedIds={new Set()}
        onSelect={() => {}}
        onToggle={() => {}}
        expandable={() => true}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'false')
  })

  it('leaves a leaf a leaf', () => {
    render(
      <Tree
        nodes={[{ id: 'notes.txt', parentId: null }]}
        selectedIds={[]}
        expandedIds={new Set()}
        onSelect={() => {}}
        onToggle={() => {}}
        expandable={() => false}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded')
  })
})

describe('flattenTree, asked what can expand', () => {
  it('takes the caller’s word over what the nodes show', () => {
    const rows = flattenTree([{ id: 'assets', parentId: null }], new Set(), () => true)

    expect(rows[0]?.hasChildren).toBe(true)
  })
})
