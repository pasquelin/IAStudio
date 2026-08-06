import { useEffect } from 'react'
import type { MenuCommand } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
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
      const state = useTools.getState()
      // Only when it differs: `toggle` would otherwise close the very tool the menu asked for.
      if (state.open[zone] !== tool) state.toggle(zone, tool)
      state.focus(zone)
    })

    const stopCommand = bridge.menu.onCommand(runCommand)

    return () => {
      stopTool()
      stopCommand()
    }
  }, [])
}
