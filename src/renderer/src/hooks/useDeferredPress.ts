import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'

export type DeferredPressProps = {
  onClick: (event: MouseEvent) => void
  onDoubleClick: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

/**
 * How long a second click may still arrive. Below the platform's own double-click window, which
 * a page cannot read: what it buys is the press feeling immediate, and 250 ms is what a hand
 * doing two clicks on purpose beats.
 */
const DOUBLE_CLICK_WINDOW = 250

/**
 * The two pointer gestures of one surface, when the SINGLE click opens something of its own.
 *
 * `selection` cannot serve that case: it fires on the first click of a pair, so a double-click
 * meant for the editor put a picker on screen first. Here the single press waits out the window
 * a second click could land in, and a double-click cancels it.
 *
 * Enter opens, Space presses — the studio's split, spelled once in `activation`.
 */
export function useDeferredPress(press: () => void, open?: () => void): DeferredPressProps {
  const waiting = useRef<number | null>(null)

  const forget = (): void => {
    if (waiting.current !== null) window.clearTimeout(waiting.current)
    waiting.current = null
  }

  useEffect(() => forget, [])

  return {
    onClick: event => {
      if (event.detail > 1) return
      // Nothing to wait for where the surface does not open: the press is the only gesture it has.
      if (!open) return press()

      forget()
      waiting.current = window.setTimeout(press, DOUBLE_CLICK_WINDOW)
    },
    onDoubleClick: () => {
      forget()
      open?.()
    },
    onKeyDown: event => {
      if (event.key !== 'Enter' || !open) return
      event.preventDefault()
      open()
    },
  }
}
