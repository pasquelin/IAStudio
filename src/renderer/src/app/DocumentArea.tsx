import type { DocumentDescriptor } from '@shared/domain/document'
import { DockviewReact, type DockviewApi, type DockviewReadyEvent } from 'dockview-react'
import { useCallback } from 'react'
import { useLayouts } from '@/stores/layouts'
import { DOCUMENT_COMPONENTS } from './documents'

// Module-level rather than a context: the rail's button and the native menu both open
// documents, and neither sits under this component.
let current: DockviewApi | null = null

export function openDocument(document: DocumentDescriptor): void {
  current?.addPanel({
    id: document.id,
    component: document.kind,
    title: document.title,
    params: { documentId: document.id },
  })
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

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      current = event.api

      const stored = useLayouts.getState().layouts[workspace]
      if (stored) event.api.fromJSON(stored)

      event.api.onDidLayoutChange(() => {
        useLayouts.getState().remember(workspace, event.api.toJSON())
      })
    },
    [workspace],
  )

  return <DockviewReact key={workspace} components={DOCUMENT_COMPONENTS} onReady={onReady} />
}
