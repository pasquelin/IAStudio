import { useEffect, useState } from 'react'
import { INITIAL_WINDOW_STATE, type WindowState } from '@shared/domain/window'

/**
 * Window state pushed by the main process. Without it the title bar would not know we entered
 * full screen, and would keep the inset that clears the traffic lights.
 */
export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>(INITIAL_WINDOW_STATE)

  useEffect(() => {
    if (typeof studio === 'undefined') return

    void studio.window.state().then(setState)
    return studio.window.onState(setState)
  }, [])

  return state
}
