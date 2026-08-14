import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
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
      label="Outline"
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
    document.documentElement.style.removeProperty('--sc-row-stacked')
    refreshPalette()
  })

  /**
   * The row is drawn at `h-full`, so the estimate IS the height: it is the one number, and a
   * constant would only be right at one density. Estimating 28 against a compact row of 24 does
   * not misplace anything — each row sits at the offset the virtualizer computed — it reserves
   * four pixels nobody paints: a dead band between every pair of rows, and 4×N of empty scroll
   * under the last one.
   */
  it('estimates the gauge its rows are drawn at, not a constant', () => {
    document.documentElement.style.setProperty('--sc-control', '24px')
    refreshPalette()

    renderTree()

    // Three visible rows: `scene` expanded over `a` and `b`.
    expect(screen.getByRole('tree')).toHaveStyle({ height: '72px' })
  })

  /**
   * A control's gauge, and no way to ask for another. The explorer used to ask for the stacked one
   * — a whole panel measured for a second line one row in thirty carried — and a tree is a list of
   * NAMES. `Collection` still takes the taller shapes, and its own suite holds them.
   */
  it('takes a control gauge whatever the tree, the stacked one being nobody’s to ask for', () => {
    document.documentElement.style.setProperty('--sc-control', '24px')
    document.documentElement.style.setProperty('--sc-row-stacked', '32px')
    refreshPalette()

    renderTree()

    expect(screen.getByRole('tree')).toHaveStyle({ height: '72px' })
  })

  it('falls back to the shipped height when no gauge is declared', () => {
    renderTree()

    expect(screen.getByRole('tree')).toHaveStyle({ height: '84px' })
  })

  /**
   * Switching density while the tree is on screen. Re-reading the gauge is not enough: the
   * virtualizer memoizes on `count` and friends, never on the estimator, so its cached
   * measurements survive a re-render and the rows keep the height the density just left.
   */
  it('re-measures when the density changes under a mounted tree', () => {
    document.documentElement.style.setProperty('--sc-control', '28px')
    refreshPalette()
    renderTree()
    expect(screen.getByRole('tree')).toHaveStyle({ height: '84px' })

    act(() => {
      document.documentElement.style.setProperty('--sc-control', '24px')
      refreshPalette()
    })

    expect(screen.getByRole('tree')).toHaveStyle({ height: '72px' })
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
        label="Outline"
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
        label="Outline"
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
  //
  // Carried by the block INSIDE the row rather than by the row itself, and that is the point: a
  // pinned column sits before it and must not walk right with the depth.
  it('indents each level by the density gauge rather than a pixel count', () => {
    renderTree()

    const indented = screen
      .getAllByRole('treeitem')
      .map(row => row.querySelector<HTMLElement>('[data-chevron]')?.parentElement)
    const [root, child] = indented
    // The factor is held too: it is what keeps a comfortable level at the 12 px it always was.
    expect(root?.style.paddingLeft).toContain('var(--sc-indent)')
    expect(child?.style.paddingLeft).toContain('var(--sc-indent)')
    expect(child?.style.paddingLeft).not.toEqual(root?.style.paddingLeft)
  })

  /**
   * The whole reason `renderTrailing` exists: the eyes of an outliner read as one straight column
   * whatever the depth or the length of a name. A control that walked right with the indent would
   * put a nested row's eye past its parent's, and there would be no column left to read.
   *
   * Asked of the OFFSET rather than of the markup: nothing between the pinned column and the row
   * may carry the indent, whatever elements the tree happens to stack in between. `a1` is two
   * levels down, and its `aria-level` is what says so without reading the DOM.
   */
  it('leaves a pinned column out of the indentation, however deep the row', () => {
    render(
      <Tree
        nodes={NODES}
        label="Outline"
        selectedIds={[]}
        expandedIds={new Set(['scene', 'a'])}
        onSelect={() => {}}
        onToggle={() => {}}
        // Marked rather than named: the row's own name is what `getByText` below asks for, and a
        // second element carrying it would make that query ambiguous.
        renderTrailing={() => <span data-pinned />}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const deepest = screen.getByText('a1').closest('[role="treeitem"]')
    expect(deepest).toHaveAttribute('aria-level', '3')

    // Walk out of the pinned column up to the row: not one step of it may be indented.
    let walked: HTMLElement | null = deepest?.querySelector<HTMLElement>('[data-pinned]') ?? null
    expect(walked).toBeInTheDocument()
    while (walked && walked !== deepest) {
      expect(walked.style.paddingLeft).toBe('')
      walked = walked.parentElement
    }
    expect(walked).toBe(deepest)
  })

  /**
   * And it is the LAST thing in the row, which is the half of the decision that took three passes:
   * pinned on the left it pushed the chevron, the indent and every name of the panel across by its
   * own width. What is on the left of an outliner is the shape of the tree.
   */
  it('pins that column after everything the depth moves, not before it', () => {
    render(
      <Tree
        nodes={NODES}
        label="Outline"
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        renderTrailing={() => <span data-pinned />}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const row = screen.getByText('a').closest('[role="treeitem"]')
    const pinned = row?.querySelector('[data-pinned]')
    const name = screen.getByText('a')

    // `DOCUMENT_POSITION_FOLLOWING` — the pinned column comes after the name in document order,
    // which is what puts it at the far end of a `flex` row.
    expect(name.compareDocumentPosition(pinned as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  /**
   * The reading a tree exists for: a row INSIDE another starts to its right, and stays there
   * whether it can be opened or not.
   *
   * Asked of the offset, because the markup is not what carries it — an attempt to close the fold
   * column on leaves passed a "does this element exist" test with flying colours while putting a
   * child at exactly its parent's x, the indent and the column being 12px each. Two names are
   * compared here rather than one classname looked up, and that is the whole difference.
   */
  it('starts a row inside another to its right, opened or not', () => {
    render(
      <Tree
        nodes={NODES}
        label="Outline"
        selectedIds={[]}
        expandedIds={new Set(['scene', 'a'])}
        onSelect={() => {}}
        onToggle={() => {}}
        renderTrailing={() => <span data-pinned />}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    // Columns are fixed-width and the indent is the only thing that moves, so what precedes a
    // name is the same run of elements at every depth: the padding IS the offset.
    const indentOf = (name: string): string =>
      screen.getByText(name).closest<HTMLElement>('[style*="padding-left"]')?.style.paddingLeft ??
      ''

    // `a1` is a LEAF two levels down, `a` the group holding it, `scene` the root. One step of the
    // gauge each, and the leaf pays it like everything else.
    expect(indentOf('scene')).toContain('* 0')
    expect(indentOf('a')).toContain('* 1')
    expect(indentOf('a1')).toContain('* 2')
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
        label="Outline"
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
        label="Outline"
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
        label="Outline"
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
        label="Outline"
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
        label="Outline"
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

  describe('dropping between rows', () => {
    /**
     * Where in the row the pointer sits is the whole of what tells an insertion from a reparent,
     * and jsdom measures every element at zero — so the row is given a height here.
     *
     * `as DOMRect`: the handler reads `top` and `height`, and writing the ten other fields of a
     * rectangle would say nothing about the drop.
     */
    function dropAt(row: HTMLElement, ratio: number, data: DataTransfer): void {
      row.getBoundingClientRect = () => ({ top: 0, height: 30 }) as DOMRect
      fireEvent.drop(row, { dataTransfer: data, clientY: 30 * ratio })
    }

    function renderInsertable(
      onInsert: (id: string, parentId: string | null, index: number) => void,
      onDrop = () => {},
    ) {
      render(
        <Tree
          nodes={NODES}
          label="Outline"
          selectedIds={[]}
          expandedIds={new Set(['scene', 'a'])}
          onSelect={() => {}}
          onToggle={() => {}}
          onDrop={onDrop}
          onInsert={onInsert}
          renderRow={row => <span>{row.node.id}</span>}
        />,
      )
      // scene, a, a1, b
      return screen.getAllByRole('treeitem')
    }

    it('reports the level receiving the row and its place in it', () => {
      const onInsert = vi.fn()
      const [, a, , b] = renderInsertable(onInsert)
      const data = dragTransfer()

      fireEvent.dragStart(b!, { dataTransfer: data })
      dropAt(a!, 0.1, data)

      expect(onInsert).toHaveBeenCalledWith('b', 'scene', 0)
    })

    /**
     * The one case every caller would get wrong on its own: a row moving DOWN its own level
     * leaves a hole behind it, so the place it lands in has shifted by one.
     */
    it('counts the target level as it will be once the row has left it', () => {
      const onInsert = vi.fn()
      const [, a, , b] = renderInsertable(onInsert)
      const data = dragTransfer()

      fireEvent.dragStart(a!, { dataTransfer: data })
      dropAt(b!, 0.9, data)

      expect(onInsert).toHaveBeenCalledWith('a', 'scene', 1)
    })

    it('takes a row out of the group holding it', () => {
      const onInsert = vi.fn()
      const [, , a1, b] = renderInsertable(onInsert)
      const data = dragTransfer()

      fireEvent.dragStart(a1!, { dataTransfer: data })
      dropAt(b!, 0.9, data)

      expect(onInsert).toHaveBeenCalledWith('a1', 'scene', 2)
    })

    it('says nothing when the row would land exactly where it already sits', () => {
      const onInsert = vi.fn()
      const [, a, , b] = renderInsertable(onInsert)
      const data = dragTransfer()

      fireEvent.dragStart(b!, { dataTransfer: data })
      dropAt(a!, 0.9, data)

      expect(onInsert).not.toHaveBeenCalled()
    })

    // The moved subtree would carry its new parent along with it, and every row under it would
    // leave the tree with no way back.
    it('refuses a row dropped inside its own subtree', () => {
      const onInsert = vi.fn()
      const [, a, a1] = renderInsertable(onInsert)
      const data = dragTransfer()

      fireEvent.dragStart(a!, { dataTransfer: data })
      dropAt(a1!, 0.1, data)

      expect(onInsert).not.toHaveBeenCalled()
    })

    it('keeps the middle of a row for the drop that reparents', () => {
      const onInsert = vi.fn()
      const onDrop = vi.fn()
      const [, a, , b] = renderInsertable(onInsert, onDrop)
      const data = dragTransfer()

      fireEvent.dragStart(b!, { dataTransfer: data })
      dropAt(a!, 0.5, data)

      expect(onDrop).toHaveBeenCalledWith('b', 'a')
      expect(onInsert).not.toHaveBeenCalled()
    })

    /** jsdom measures at zero, so the row is given a height for the hover as for the drop. */
    function hoverAt(row: HTMLElement, ratio: number, data: DataTransfer): void {
      row.getBoundingClientRect = () => ({ top: 0, height: 30 }) as DOMRect
      fireEvent.dragOver(row, { dataTransfer: data, clientY: 30 * ratio })
    }

    it('opens a gap where the row would land, showing the row that would land there', () => {
      const [, a, , b] = renderInsertable(() => {})
      const data = dragTransfer()

      fireEvent.dragStart(b!, { dataTransfer: data })
      hoverAt(a!, 0.1, data)

      // Four rows and a ghost: the list grew by one while the drop is being aimed.
      const drawn = screen.getAllByText('b')
      expect(drawn).toHaveLength(2)
      expect(a!.className).not.toContain('outline-accent')
    })

    it('dims the row the hand is holding rather than taking it out of the list', () => {
      const [, a, , b] = renderInsertable(() => {})
      const data = dragTransfer()

      fireEvent.dragStart(b!, { dataTransfer: data })
      hoverAt(a!, 0.1, data)

      expect(screen.getAllByRole('treeitem')).toHaveLength(4)
      expect(b!.className).toContain('opacity-40')
    })

    it('takes the gap back when the pointer leaves without dropping', () => {
      const [, a, , b] = renderInsertable(() => {})
      const data = dragTransfer()

      fireEvent.dragStart(b!, { dataTransfer: data })
      hoverAt(a!, 0.1, data)
      fireEvent.dragEnd(b!)

      expect(screen.getAllByText('b')).toHaveLength(1)
    })

    /**
     * A row beside a group belongs below everything the group holds. Placing the ghost right
     * after the group's own row would show it landing between the group and its first child —
     * a place the drop never puts it.
     */
    it('places the ghost below the whole subtree when it lands after a group', () => {
      // `a1` comes out of `a` and lands beside it, at the root.
      const [, a, a1] = renderInsertable(() => {})
      const data = dragTransfer()

      fireEvent.dragStart(a1!, { dataTransfer: data })
      hoverAt(a!, 0.9, data)

      // The ghost sits below `a1`, not between `a` and it: that is where the drop puts it.
      const drawn = screen.getAllByText(/^(a|a1|b)$/).map(node => node.textContent)
      expect(drawn).toEqual(['a', 'a1', 'a1', 'b'])
    })

    it('picks up a row for a tree that only inserts', () => {
      render(
        <Tree
          nodes={NODES}
          label="Outline"
          selectedIds={[]}
          expandedIds={new Set(['scene'])}
          onSelect={() => {}}
          onToggle={() => {}}
          onInsert={() => {}}
          renderRow={row => <span>{row.node.id}</span>}
        />,
      )

      expect(screen.getAllByRole('treeitem')[1]).toHaveAttribute('draggable', 'true')
    })
  })

  it('tells the caller what is being dragged, so a target can judge the pair', () => {
    const droppable = vi.fn(() => true)
    render(
      <Tree
        nodes={NODES}
        label="Outline"
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
        label="Outline"
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

  /**
   * A drag cancelled after its source row scrolled out of the window fires no `dragEnd`, so the
   * tree goes on holding the node it picked up. The channel is shared by every tree of the
   * studio, so the next drag started anywhere at all would be reported here as that stale node —
   * moving something the hand never touched.
   */
  it('ignores a drop carrying something other than what it picked up', () => {
    const onDrop = vi.fn()
    render(
      <Tree
        nodes={NODES}
        label="Outline"
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onDrop={onDrop}
        renderRow={row => <span>{row.node.id}</span>}
      />,
    )

    const rows = screen.getAllByRole('treeitem')
    fireEvent.dragStart(rows[1]!, { dataTransfer: dragTransfer() })

    const elsewhere = dragTransfer()
    elsewhere.setData('application/x-scenario-tree-row', 'from-another-tree')
    fireEvent.drop(rows[2]!, { dataTransfer: elsewhere })

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

    await userEvent.click(
      screen.getAllByRole('treeitem')[0]?.querySelector('[data-chevron]') as HTMLElement,
    )

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
        label="Outline"
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
describe('Tree, the menu a right-click opens', () => {
  const withMenu = (renderRow: (row: { node: { id: string } }) => ReactNode) => {
    const onContextMenu = vi.fn()
    render(
      <Tree
        nodes={NODES}
        label="Outline"
        selectedIds={[]}
        expandedIds={new Set(['scene'])}
        onSelect={() => {}}
        onToggle={() => {}}
        onContextMenu={onContextMenu}
        renderRow={renderRow}
      />,
    )
    return onContextMenu
  }

  it('names the node the pointer was over', () => {
    const onContextMenu = withMenu(row => <span>{row.node.id}</span>)

    fireEvent.contextMenu(screen.getByText('a'))

    expect(onContextMenu).toHaveBeenCalledWith(NODES[1])
  })

  /**
   * A row can BE a text field — the explorer renames in place — and the press then belongs to the
   * native clipboard menu, which Chromium never asks the main process for once this row has
   * called `preventDefault` (`main/window/context-menu.ts`).
   */
  it('leaves a right-click inside a row that is a field to the native menu', () => {
    const onContextMenu = withMenu(row =>
      row.node.id === 'a' ? <input /> : <span>{row.node.id}</span>,
    )

    const raised = fireEvent.contextMenu(screen.getByRole('textbox'))

    expect(raised).toBe(true)
    expect(onContextMenu).not.toHaveBeenCalled()
  })
})

describe('Tree, opening a row', () => {
  const withActivate = (onActivate: (node: { id: string }) => void, onSelect = vi.fn()) =>
    render(
      <Tree
        nodes={NODES}
        label="Outline"
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
        label="Outline"
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
        label="Outline"
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
