import { useEffect } from 'react'
import type { MenuCommand } from '@shared/ipc'
import { getBridge } from '@/services/bridge'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'

function runCommand(command: MenuCommand): void {
  switch (command) {
    case 'layout:reset':
      useTools.getState().reset()
      return
    case 'settings:open':
      useSettings.getState().openAccountDialog()
      return
    case 'project:new':
    case 'project:open':
      // Not wired yet: the project store has no IPC handler. The menu entries are disabled
      // in the main process so the user never reaches this branch.
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
      // `toggle` both opens a closed tool and expands a collapsed one; calling it only when
      // the tool differs would leave a collapsed panel collapsed — the exact case the menu
      // exists to recover from.
      if (state.open[zone] !== tool || state.collapsed[zone]) state.toggle(zone, tool)
      state.focus(zone)
    })

    const stopCommand = bridge.menu.onCommand(runCommand)

    return () => {
      stopTool()
      stopCommand()
    }
  }, [])
}
