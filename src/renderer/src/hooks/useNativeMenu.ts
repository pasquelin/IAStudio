import { useEffect } from 'react'
import type { CommandId } from '@shared/domain/command'
import { saveDocument } from '@/app/document-io'
import { toolZoneIn } from '@/helpers/tool-registry'
import { getBridge } from '@/services/bridge'
import { addNodeTo } from '@/hooks/useAddNode'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useTools } from '@/stores/tools'

/** The global commands, which are the ones the native menu fires. The rest belong to a surface. */
function runCommand(command: CommandId): void {
  switch (command) {
    case 'layout.reset':
      useTools.getState().reset()
      return
    case 'project.new':
      void useProject.getState().createPicked()
      return
    case 'project.open':
      void useProject.getState().openPicked()
      return
    case 'document.save': {
      // The menu is application-wide and has no idea which tab is in front; the store does.
      const documentId = useDocuments.getState().activeId
      // Caught, not left to `void`: nothing logs an IPC rejection and the studio has no error
      // surface, so the tab keeping its marker is the whole of what a failed save reports.
      if (documentId) void saveDocument(documentId).catch(() => {})
      return
    }
  }
}

/**
 * Wires the native menu to the shell. Without this listener, "View ▸ Tool windows" would emit
 * into the void and the menu entries would silently do nothing.
 */
export function useNativeMenu(): void {
  // Subscribed once for the lifetime of the app: every listener below reads its store at call
  // time, so nothing here has to be torn down when a tab or a document changes.
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    // The persisted workspace is restored without going through `setActiveWorkspace`, so the
    // menu would sit on the default until the user switched spaces by hand.
    void bridge.window.setWorkspace(useLayouts.getState().activeWorkspace)

    const stopTool = bridge.menu.onOpenTool(({ tool }) => {
      // The zone is resolved here rather than taken from the menu: a tool can sit in different
      // zones depending on the workspace, and the menu is built once for the whole app. `null`
      // means this workspace does not serve it — opening it would accent a rail icon that is
      // not drawn and show nothing.
      const zone = toolZoneIn(tool, useLayouts.getState().activeWorkspace)
      if (!zone) return

      useTools.getState().show(zone, tool)
    })

    const stopCommand = bridge.menu.onCommand(runCommand)
    // The same path the toolbar and the panels take: two ways of adding a node would drift.
    const stopSceneAdd = bridge.menu.onSceneAdd(({ kind }) => {
      // Of the right kind: the menu is app-wide, and a node written under an image document
      // would give it a scene and a history it has no editor for.
      const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
      if (documentId) addNodeTo(documentId, kind)
    })

    return () => {
      stopTool()
      stopCommand()
      stopSceneAdd()
    }
  }, [])
}
