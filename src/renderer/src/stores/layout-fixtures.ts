import { Orientation } from 'dockview-react'
import type { SerializedLayout } from './layouts'
import { useLayouts } from './layouts'
import type { WorkspaceId } from '@shared/domain/workspace'

/**
 * A persisted layout holding one panel per id, in the shape Dockview writes.
 *
 * Only `panels` is ever read back — `panelIds` is the one consumer — but the whole shape is
 * built rather than cast: a fixture that lies about its type is a test passing on something
 * production never sees.
 */
export function layoutShowing(...ids: readonly string[]): SerializedLayout {
  return {
    grid: {
      root: { type: 'branch', data: [] },
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
