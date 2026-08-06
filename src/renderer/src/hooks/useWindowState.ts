import { useEffect, useState } from 'react'
import { INITIAL_WINDOW_STATE, type WindowState } from '@shared/domain/window'

/**
 * État de la fenêtre poussé par le main. Sans lui, la barre de titre ne saurait pas qu'on
 * est passé en plein écran, et garderait le retrait qui dégage les feux de circulation.
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
