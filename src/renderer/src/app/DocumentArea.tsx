import { DockviewReact, type DockviewReadyEvent } from 'dockview-react'
import { useCallback } from 'react'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { DOCUMENT_COMPONENTS } from './documents'
import { setDockviewApi } from './dockview-api'

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
      if (stored) event.api.fromJSON(stored)

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
