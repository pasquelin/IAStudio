import { useEffect, useState } from 'react'
import { IDLE_RESCAN, type RescanState } from '@shared/domain/project'
import { getBridge } from '@/services/bridge'

/**
 * How far the pass reconciling the catalogue with the project folder has got.
 *
 * Asked once at mount as well as subscribed to: a window opened — or a panel remounted — while a
 * pass is running would otherwise show nothing until the next progress line, which on a project
 * of a few files never comes.
 *
 * A window never STARTS a pass. Opening a project and coming back to the front are what do, and
 * both are decided in the main process where the one-at-a-time rule lives.
 */
export function useRescan(): RescanState {
  const [state, setState] = useState<RescanState>(IDLE_RESCAN)

  useEffect(() => {
    let announced = false

    // Subscribed BEFORE the state is asked for, and the answer is dropped once anything has been
    // announced: the ask is a round trip, and a pass that progressed while it was in flight would
    // otherwise be painted back to where it stood when the panel opened.
    const stop = getBridge()?.project.onRescan(next => {
      announced = true
      setState(next)
    })

    void getBridge()
      ?.project.rescanState()
      .then(current => {
        if (!announced) setState(current)
      })

    return stop
  }, [])

  return state
}
