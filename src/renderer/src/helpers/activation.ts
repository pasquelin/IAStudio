import type { KeyboardEvent, MouseEvent } from 'react'

export type ActivationProps = {
  onDoubleClick: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

/**
 * What OPENING a thing answers to: a double-click, and Enter for the keyboard that has no such
 * gesture. The attributes to spread on the element, the way `tooltip.ts` hands over its own.
 *
 * One rule a hand can learn is one rule written once — `Collection` and `Tree` each spell it out
 * for the rows they own, and every surface that grew a third one spelled it slightly differently.
 * Space is deliberately left alone: it picks, everywhere else in the studio, and a tile that
 * opened a document on it would be switching workspace under a key that never does.
 */
export function activation(open: () => void): ActivationProps {
  return {
    onDoubleClick: open,
    onKeyDown: event => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      open()
    },
  }
}

/**
 * What LOOKING answers to, on a surface that also opens: a single click, Space with it, and never
 * the second click of a double — `detail` is what the platform gives to tell the two apart.
 */
export function selection(look: () => void): { onClick: (event: MouseEvent) => void } {
  return { onClick: event => event.detail < 2 && look() }
}
