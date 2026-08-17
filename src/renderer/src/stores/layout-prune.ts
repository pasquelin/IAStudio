import type { SerializedLayout } from './serialized-layout'

type GridNode = SerializedLayout['grid']['root']
/** The leaf half of a grid node: one group of tabs, named by the ids it holds. */
type GroupState = Extract<GridNode['data'], { views: string[] }>
/** What a floating or a popout window holds — one group, or a grid of them, never both. */
type WindowGrid = NonNullable<NonNullable<SerializedLayout['floatingGroups']>[number]['grid']>
type WindowContent = { data?: GroupState; grid?: WindowGrid }

/**
 * The same layout without those panels, or `null` when it no longer holds any.
 *
 * A panel id appears in three places at once — the `panels` registry, the `views` of the group
 * showing it, and possibly a floating or popout window — and Dockview restores none of it
 * defensively: `fromJSON` builds each view from `panels[id]`, so a `views` naming an id the
 * registry lost throws and costs the whole arrangement.
 */
export function withoutPanels(
  layout: SerializedLayout,
  removed: ReadonlySet<string>,
): SerializedLayout | null {
  const panels = Object.fromEntries(
    Object.entries(layout.panels).filter(([id]) => !removed.has(id)),
  )
  if (Object.keys(panels).length === 0) return null

  const root = prunedNode(layout.grid.root, removed)

  return {
    ...layout,
    panels,
    // `fromJSON` throws on a root that is not a branch, so an emptied one keeps the shape
    // rather than the node. `activeGroup` is left alone on purpose: a group that is gone is
    // looked up and skipped there, and no id of ours can name one anyway.
    grid: { ...layout.grid, root: root ?? { type: 'branch', data: [] } },
    floatingGroups: prunedWindows(layout.floatingGroups, removed),
    popoutGroups: prunedWindows(layout.popoutGroups, removed),
  }
}

function prunedWindows<W extends WindowContent>(
  windows: readonly W[] | undefined,
  removed: ReadonlySet<string>,
): W[] | undefined {
  return windows?.flatMap(window => {
    const content = prunedWindow(window, removed)
    return content ? { ...window, ...content } : []
  })
}

/** Edge groups are left as they are: Dockview types their group as `unknown`, and we open none. */
function prunedWindow(window: WindowContent, removed: ReadonlySet<string>): WindowContent | null {
  if (window.grid) {
    const root = prunedNode(window.grid.root, removed)
    return root ? { grid: { ...window.grid, root } } : null
  }
  if (!window.data) return {}

  const group = prunedGroup(window.data, removed)
  return group ? { data: group } : null
}

function prunedNode(node: GridNode, removed: ReadonlySet<string>): GridNode | null {
  if (Array.isArray(node.data)) {
    const data = node.data.flatMap(child => prunedNode(child, removed) ?? [])
    return data.length === 0 ? null : { ...node, data }
  }

  const group = prunedGroup(node.data, removed)
  return group ? { ...node, data: group } : null
}

function prunedGroup(group: GroupState, removed: ReadonlySet<string>): GroupState | null {
  const views = group.views.filter(view => !removed.has(view))
  if (views.length === 0) return null

  // A group whose active tab went away shows the first one left rather than none: Dockview
  // matches `activeView` against the panels it built, and an unmatched one leaves a headless
  // group. A group that named none keeps naming none — that is Dockview's own default, not a
  // tab that lost its place.
  const activeView =
    group.activeView === undefined || views.includes(group.activeView) ? group.activeView : views[0]
  return { ...group, views, activeView }
}
