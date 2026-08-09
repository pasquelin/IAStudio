import { Orientation } from 'dockview-react'
import type { SerializedLayout } from './layouts'
import { useLayouts } from './layouts'
import type { WorkspaceId } from '@shared/domain/workspace'

/**
 * A persisted layout holding one panel per id, in the shape Dockview writes.
 *
 * The whole shape is built rather than cast: a fixture that lies about its type is a test
 * passing on something production never sees. The grid names the same ids as `panels` for that
 * reason — `panelIds` reads only the registry, but `prune` walks the groups, and a layout whose
 * halves disagree is one Dockview would refuse to restore.
 */
export function layoutShowing(...ids: readonly string[]): SerializedLayout {
  return {
    grid: {
      root: {
        type: 'branch',
        data: ids.length === 0 ? [] : [{ type: 'leaf', data: { id: 'group-1', views: [...ids] } }],
      },
      width: 0,
      height: 0,
      orientation: Orientation.HORIZONTAL,
    },
    panels: Object.fromEntries(ids.map(id => [id, { id }])),
  }
}

/** Installs that layout under one workspace, which is what says those documents are open. */
export function showPanels(workspace: WorkspaceId, ...ids: readonly string[]): void {
  useLayouts.setState({ layouts: { [workspace]: layoutShowing(...ids) } })
}
