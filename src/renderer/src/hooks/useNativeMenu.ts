import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { placementOf } from '@shared/domain/tool'
import type { MenuCommand } from '@shared/ipc'
import { toolServes } from '@/helpers/tool-registry'
import { getBridge } from '@/services/bridge'
import { addNodeTo } from '@/hooks/useAddNode'
import { activeIdOfKind, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useTools } from '@/stores/tools'

function runCommand(command: MenuCommand): void {
  switch (command) {
    case 'layout:reset':
      useTools.getState().reset()
      return
    case 'project:new':
      void useProject.getState().createPicked()
      return
    case 'project:open':
      void useProject.getState().openPicked()
      return
  }
}

/**
 * Wires the native menu to the shell. Without this listener, "View ▸ Tool windows" would emit
 * into the void and the menu entries would silently do nothing.
 */
export function useNativeMenu(): void {
  const { t } = useTranslation()
  // Held in a ref rather than depended on: this hook sits at the app root, and re-subscribing
  // three IPC listeners on every tab switch is three round-trips to refresh one closure.
  const translate = useRef(t)
  useEffect(() => {
    translate.current = t
  }, [t])

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    // The persisted workspace is restored without going through `setActiveWorkspace`, so the
    // menu would sit on the default until the user switched spaces by hand.
    void bridge.window.setWorkspace(useLayouts.getState().activeWorkspace)

    const stopTool = bridge.menu.onOpenTool(({ zone, tool }) => {
      // A tool the active workspace does not serve is filtered out of the zone, so opening it
      // would accent a rail icon that is not drawn and show nothing.
      if (!toolServes(tool, useLayouts.getState().activeWorkspace)) return

      const state = useTools.getState()
      const slot = placementOf(tool)?.slot
      // Only when it is not already up: `toggle` would otherwise close the very tool the menu
      // asked for.
      if (slot && state.open[zone]?.[slot] !== tool) state.toggle(zone, tool)
      state.focus(zone)
    })

    const stopCommand = bridge.menu.onCommand(runCommand)
    // The same path the toolbar and the panels take: two ways of adding a node would drift.
    const stopSceneAdd = bridge.menu.onSceneAdd(({ kind }) => {
      // Of the right kind: the menu is app-wide, and a node written under an image document
      // would give it a scene and a history it has no editor for.
      const documentId = activeIdOfKind(useDocuments.getState(), 'scene')
      if (documentId) addNodeTo(documentId, kind, translate.current)
    })

    return () => {
      stopTool()
      stopCommand()
      stopSceneAdd()
    }
  }, [])
}
