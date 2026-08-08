import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react'
import { useCallback } from 'react'
import type { WorkspaceId } from '@shared/domain/workspace'
import { useDocuments } from '@/stores/documents'
import { useLayouts, type SerializedLayout } from '@/stores/layouts'
import { DOCUMENT_COMPONENTS } from './documents'
import { setDockviewApi } from './dockview-api'

/**
 * A layout is written by Dockview straight into localStorage and never read back by us, so
 * nothing says it is still one. Dockview clears itself and rethrows on a layout it refuses —
 * from inside its own mount effect, where an uncaught throw takes the window with it, on every
 * launch, with no way for the user to reach the bad value.
 *
 * So the arrangement is dropped rather than the window: an empty workspace is a Tuesday, a
 * window that will not open is not.
 */
function restoreLayout(api: DockviewApi, workspace: WorkspaceId, stored: SerializedLayout): void {
  try {
    api.fromJSON(stored)
  } catch (error) {
    console.error(`Discarding an unreadable layout for the "${workspace}" workspace:`, error)
    useLayouts.getState().forget(workspace)
  }
}

/**
 * Dockview, remounted per workspace by its `key`: coming back to "3D" must restore that
 * workspace's tabs, not the ones from "Image".
 *
 * Remounting destroys the WebGL context of any open viewport. That is the point — engines are
 * rebuilt from their state, never moved, which is what detaching a panel into another window
 * will demand.
 */
export function DocumentArea() {
  const workspace = useLayouts(state => state.activeWorkspace)
  // Keyed by the project too: Dockview holds its panels itself, and dropping the stored layout
  // of the project being left would otherwise leave its tabs on screen — then persist them
  // again, under the project that never had them, on the first layout change.
  const projectPath = useLayouts(state => state.projectPath)

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      setDockviewApi(event.api)

      const stored = useLayouts.getState().layouts[workspace]
      if (stored) restoreLayout(event.api, workspace, stored)

      event.api.onDidLayoutChange(() => {
        useLayouts.getState().remember(workspace, event.api.toJSON())
      })

      // Tool windows live outside Dockview: without this, a layer stack on the edge has no way
      // of knowing which tab it is looking at.
      useDocuments.getState().activate(event.api.activePanel?.id ?? null)
      event.api.onDidActivePanelChange(change => {
        useDocuments.getState().activate(change.panel?.id ?? null)
      })
    },
    [workspace],
  )

  return (
    <DockviewReact
      key={`${projectPath ?? ''}:${workspace}`}
      components={DOCUMENT_COMPONENTS}
      onReady={onReady}
    />
  )
}
