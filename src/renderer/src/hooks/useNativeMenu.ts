import { useEffect } from 'react'
import { placementOf } from '@shared/domain/tool'
import type { MenuCommand } from '@shared/ipc'
import { toolServes } from '@/app/tools'
import { getBridge } from '@/services/bridge'
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
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

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

    return () => {
      stopTool()
      stopCommand()
    }
  }, [])
}
