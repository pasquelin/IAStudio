import { useEffect } from 'react'
import { isToolId, isToolZone } from '@/app/tools'
import { useTools } from '@/stores/tools'

/**
 * Wires the native menu to the shell. This is how a tool removed with its close button comes
 * back: without this listener, "View ▸ Tool windows" would do nothing and the panel would be
 * lost for good.
 */
export function useNativeMenu(): void {
  useEffect(() => {
    if (typeof studio === 'undefined') return

    const stopTool = studio.menu.onOpenTool(({ zone, tool }) => {
      if (!isToolZone(zone) || !isToolId(tool)) return
      const state = useTools.getState()
      if (state.open[zone] !== tool) state.toggle(zone, tool)
      state.focus(zone)
    })

    const stopCommand = studio.menu.onCommand(command => {
      if (command === 'layout:reset') useTools.getState().reset()
    })

    return () => {
      stopTool()
      stopCommand()
    }
  }, [])
}
