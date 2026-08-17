import { Orientation } from 'dockview-react'
import { describe, expect, it } from 'vitest'
import { withoutPanels } from './layoutPrune'
import type { SerializedLayout } from './serializedLayout'

type Grid = SerializedLayout['grid']
type Node = Grid['root']
type Group = Extract<Node['data'], { views: string[] }>

function group(id: string, views: readonly string[], activeView?: string): Group {
  return { id, views: [...views], activeView }
}

function leaf(state: Group): Node {
  return { type: 'leaf', data: state }
}

function grid(...children: readonly Node[]): Grid {
  return {
    root: { type: 'branch', data: [...children] },
    width: 800,
    height: 600,
    orientation: Orientation.HORIZONTAL,
  }
}

function layout(root: Grid, ...ids: readonly string[]): SerializedLayout {
  return { grid: root, panels: Object.fromEntries(ids.map(id => [id, { id }])) }
}

/** The grid, flattened to the views each group holds — what Dockview rebuilds tabs from. */
function views(node: Node): string[][] {
  return Array.isArray(node.data) ? node.data.flatMap(views) : [node.data.views]
}

describe('withoutPanels', () => {
  it('takes the panel out of the registry', () => {
    const before = layout(grid(leaf(group('g1', ['kept', 'ghost']))), 'kept', 'ghost')

    const after = withoutPanels(before, new Set(['ghost']))

    expect(Object.keys(after?.panels ?? {})).toEqual(['kept'])
  })

  // `fromJSON` builds every view from `panels[id]`, so a view naming a dropped panel throws and
  // costs the whole arrangement rather than the one tab.
  it('takes the panel out of the group showing it', () => {
    const before = layout(grid(leaf(group('g1', ['kept', 'ghost']))), 'kept', 'ghost')

    const after = withoutPanels(before, new Set(['ghost']))

    expect(views(after?.grid.root ?? { type: 'branch', data: [] })).toEqual([['kept']])
  })

  it('drops a group left with no view, and leaves its neighbour alone', () => {
    const before = layout(
      grid(leaf(group('g1', ['ghost'])), leaf(group('g2', ['kept']))),
      'ghost',
      'kept',
    )

    const after = withoutPanels(before, new Set(['ghost']))

    expect(views(after?.grid.root ?? { type: 'branch', data: [] })).toEqual([['kept']])
  })

  it('drops a branch whose every group emptied', () => {
    const nested = grid(
      { type: 'branch', data: [leaf(group('g1', ['ghost'])), leaf(group('g2', ['other']))] },
      leaf(group('g3', ['kept'])),
    )

    const after = withoutPanels(
      layout(nested, 'ghost', 'other', 'kept'),
      new Set(['ghost', 'other']),
    )

    expect(after?.grid.root.data).toHaveLength(1)
  })

  // An `activeView` Dockview cannot match against the panels it built leaves a headless group.
  it('moves the active view to the first one left when it was the one removed', () => {
    const before = layout(grid(leaf(group('g1', ['first', 'ghost'], 'ghost'))), 'first', 'ghost')

    const after = withoutPanels(before, new Set(['ghost']))

    expect(views(after?.grid.root ?? { type: 'branch', data: [] })).toEqual([['first']])
    expect(after?.grid.root.data).toEqual([leaf(group('g1', ['first'], 'first'))])
  })

  it('keeps the active view when it survived', () => {
    const before = layout(grid(leaf(group('g1', ['ghost', 'kept'], 'kept'))), 'ghost', 'kept')

    const after = withoutPanels(before, new Set(['ghost']))

    expect(after?.grid.root.data).toEqual([leaf(group('g1', ['kept'], 'kept'))])
  })

  it('answers nothing at all when the layout holds no other panel', () => {
    const before = layout(grid(leaf(group('g1', ['ghost']))), 'ghost')

    expect(withoutPanels(before, new Set(['ghost']))).toBeNull()
  })

  // Dockview throws outright on a root that is not a branch, so an emptied grid keeps the shape.
  it('leaves the root a branch when the grid empties under a surviving panel', () => {
    const before = layout(grid(leaf(group('g1', ['ghost']))), 'ghost', 'unplaced')

    const after = withoutPanels(before, new Set(['ghost']))

    expect(after?.grid.root).toEqual({ type: 'branch', data: [] })
  })

  it('leaves a layout naming none of them as it was', () => {
    const before = layout(grid(leaf(group('g1', ['kept']))), 'kept')

    expect(withoutPanels(before, new Set(['elsewhere']))).toEqual(before)
  })

  // Shift-dragging a tab out makes a floating group, which is on by default: a ghost can be
  // sitting in one, and Dockview restores those from the same panel registry.
  it('takes the panel out of a floating group', () => {
    const before: SerializedLayout = {
      ...layout(grid(leaf(group('g1', ['kept']))), 'kept', 'ghost'),
      floatingGroups: [
        { data: group('floating', ['ghost']), position: { top: 0, left: 0, width: 0, height: 0 } },
      ],
    }

    const after = withoutPanels(before, new Set(['ghost']))

    expect(after?.floatingGroups).toEqual([])
  })

  it('walks the grid of a floating window holding more than one group', () => {
    const before: SerializedLayout = {
      ...layout(grid(leaf(group('g1', ['kept']))), 'kept', 'ghost', 'other'),
      floatingGroups: [
        {
          grid: grid(leaf(group('f1', ['ghost'])), leaf(group('f2', ['other']))),
          position: { top: 0, left: 0, width: 0, height: 0 },
        },
      ],
    }

    const after = withoutPanels(before, new Set(['ghost']))

    expect(views(after?.floatingGroups?.[0]?.grid?.root ?? { type: 'branch', data: [] })).toEqual([
      ['other'],
    ])
  })

  it('takes the panel out of a popout window too', () => {
    const before: SerializedLayout = {
      ...layout(grid(leaf(group('g1', ['kept']))), 'kept', 'ghost'),
      popoutGroups: [{ data: group('popped', ['ghost', 'kept']), position: null }],
    }

    const after = withoutPanels(before, new Set(['ghost']))

    expect(after?.popoutGroups?.[0]?.data?.views).toEqual(['kept'])
  })

  it('drops a popout window left with nothing to show', () => {
    const before: SerializedLayout = {
      ...layout(grid(leaf(group('g1', ['kept']))), 'kept', 'ghost'),
      popoutGroups: [{ data: group('popped', ['ghost']), position: null }],
    }

    const after = withoutPanels(before, new Set(['ghost']))

    expect(after?.popoutGroups).toEqual([])
  })
})
