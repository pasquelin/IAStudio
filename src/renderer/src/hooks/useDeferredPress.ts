import { useCallback, useMemo, type MouseEvent } from 'react'
import { activation, type ActivationProps } from '@/helpers/activation'
import { useForgettableTimeout } from './useForgettableTimeout'
import { useLatest } from './useLatest'

export type DeferredPressProps = Partial<ActivationProps> & {
  onClick?: (event: MouseEvent) => void
}

/**
 * How long a second click may still arrive. 🛑 At or ABOVE the platform's own window, never under:
 * Chromium waits ~500 ms, and a shorter wait fires the press while a `dblclick` is still coming.
 */
const DOUBLE_CLICK_WINDOW = 500

/**
 * The two pointer gestures of one surface, when the SINGLE click opens something of its own.
 *
 * 🛑 Not `selection`: it fired on the FIRST click of a pair, so a double-click meant for the
 * editor put a picker on screen first. Here the press waits that window out, and opening cancels
 * it. The handlers keep their identity across renders, which is why both runs are mirrored.
 */
export function useDeferredPress(press?: () => void, open?: () => void): DeferredPressProps {
  const timeout = useForgettableTimeout()
  const latest = useLatest({ press, open })

  const onClick = useCallback(
    (event: MouseEvent) => {
      const { press: pressing, open: opening } = latest.current
      if (event.detail > 1 || !pressing) return
      // Nothing to wait for where the surface does not open: the press is its only gesture.
      if (!opening) return pressing()

      timeout.after(DOUBLE_CLICK_WINDOW, pressing)
    },
    [latest, timeout],
  )

  const opening = useCallback(() => {
    timeout.forget()
    latest.current.open?.()
  }, [latest, timeout])

  // Composed, never re-spelled: `activation` is the studio's one answer to "what opens a thing".
  const opens = useMemo(() => activation(opening), [opening])

  // The RUNS are mirrored, so what the object depends on is only whether each gesture EXISTS.
  const presses = Boolean(press)
  const opened = Boolean(open)

  return useMemo(
    () => ({ ...(presses && { onClick }), ...(opened && opens) }),
    [presses, opened, onClick, opens],
  )
}
