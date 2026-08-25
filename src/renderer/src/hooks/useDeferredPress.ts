import { useEffect, useRef, type MouseEvent } from 'react'
import { activation, type ActivationProps } from '@/helpers/activation'

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
 * 🛑 Not `selection`: it fires on the FIRST click of a pair, so a double-click meant for the
 * editor put a picker on screen first. Here the press waits that window out, and opening cancels it.
 */
export function useDeferredPress(press?: () => void, open?: () => void): DeferredPressProps {
  const waiting = useRef<number | null>(null)

  const forget = (): void => {
    if (waiting.current !== null) window.clearTimeout(waiting.current)
    waiting.current = null
  }

  useEffect(() => forget, [])

  const opening = open && activation(open)

  return {
    ...(press && {
      onClick: (event: MouseEvent) => {
        if (event.detail > 1) return
        // Nothing to wait for where the surface does not open: the press is its only gesture.
        if (!open) return press()

        forget()
        waiting.current = window.setTimeout(press, DOUBLE_CLICK_WINDOW)
      },
    }),
    // Composed rather than handed a closure: `activation` is called with `open` itself, and the
    // cancellation is laid over what it returns — `react-hooks/refs` refuses the other order.
    ...(opening && {
      ...opening,
      onDoubleClick: () => {
        forget()
        opening.onDoubleClick()
      },
    }),
  }
}
