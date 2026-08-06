import { useEffect, useState } from 'react'
import { INITIAL_WINDOW_STATE, type WindowState } from '@shared/domain/window'
import { getBridge } from '@/services/bridge'

/**
 * Window state pushed by the main process. Without it the title bar would not know we entered
 * full screen, and would keep the inset that clears the traffic lights.
 */
export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>(INITIAL_WINDOW_STATE)

  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    void bridge.window.state().then(setState)
    return bridge.window.onState(setState)
  }, [])

  return state
}
