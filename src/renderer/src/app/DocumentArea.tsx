import { DockviewReact, type DockviewReadyEvent } from 'dockview-react'
import { useCallback } from 'react'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { DocumentTab } from './DocumentTab'
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
      const stored = useLayouts.getState().layouts[workspace]
      if (stored) {
        try {
          event.api.fromJSON(stored)
        } catch (error) {
          // Dockview rethrows a layout it refuses from inside its own mount effect, where an
          // uncaught throw would take the window down on every launch. Forgotten, not kept:
          // nothing reloads it afterwards, so a kept one would fail again at every switch.
          console.error(`Discarding an unreadable layout for the "${workspace}" workspace:`, error)
          useLayouts.getState().forget(workspace)
        }
      }

      // AFTER the stored layout is restored, never before: handing the api over drains the
      // documents waiting for this workspace, and `fromJSON` clears the panels it did not name —
      // a document opened from another workspace would be added and then thrown away.
      setDockviewApi(workspace, event.api)

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
      // Every tab, not a per-panel choice: closing a document has to ask about unsaved work
      // whichever space opened it.
      defaultTabComponent={DocumentTab}
      onReady={onReady}
    />
  )
}
