import { useEffect } from 'react'
import { useTools } from '@/stores/tools'
import { getBridge } from '@/services/bridge'

/**
 * Wires the native menu to the shell. This is how a tool removed with its close button comes
 * back: without this listener, "View ▸ Tool windows" would do nothing and the panel would be
 * lost for good.
 */
export function useNativeMenu(): void {
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    const stopTool = bridge.menu.onOpenTool(({ zone, tool }) => {
      const state = useTools.getState()
      if (state.open[zone] !== tool) state.toggle(zone, tool)
      state.focus(zone)
    })

    const stopCommand = bridge.menu.onCommand(command => {
      if (command === 'layout:reset') useTools.getState().reset()
    })

    return () => {
      stopTool()
      stopCommand()
    }
  }, [])
}
