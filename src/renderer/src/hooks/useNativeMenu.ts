import { useEffect } from 'react'
import { isToolId, isToolZone } from '@/app/tools'
import { useTools } from '@/stores/tools'

/**
 * Relie le menu natif au shell. C'est par là qu'un module retiré par sa croix revient :
 * sans cette écoute, « Affichage ▸ Modules » ne ferait rien et le panneau serait perdu.
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
