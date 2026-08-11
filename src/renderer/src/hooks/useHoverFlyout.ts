import { useCallback, useEffect, useRef, useState } from 'react'

export type HoverFlyout = {
  /** A single row is not a menu: the button acts directly, as map3D's toolbar does. */
  hasFlyout: boolean
  showing: boolean
  /**
   * Whether the menu was asked for — clicked, or keyed, which a button reports as a click —
   * rather than hovered into. Only an asked-for menu may take the focus and answer the arrows:
   * one the pointer merely crossed would pull the caret out of whatever was being typed.
   */
  asked: boolean
  /** Goes on the button's wrapper. */
  wrapProps: { onPointerEnter: () => void; onPointerLeave: () => void }
  /**
   * Goes on the menu itself — without it, reaching the rows closes them. It carries the menu's
   * manners too, so every mounting gets the same ones rather than three lines of policy each:
   * dismissal always, and the keyboard only once the menu was asked for.
   */
  flyoutProps: {
    onPointerEnter: () => void
    onPointerLeave: () => void
    onDismiss: () => void
    onKeyClose: (() => void) | undefined
  }
  /**
   * The opening a keyboard asks for, since hovering is not a keyboard gesture — a click on a
   * button whose only job is its menu, or `Alt+ArrowDown` on one whose click does something else.
   * It records the ask whether or not there are rows to show, so a caller with a row count that
   * varies has to check `hasFlyout` first.
   */
  open: () => void
  close: () => void
}

/**
 * Milliseconds the menu survives the pointer leaving. The menu is portalled to the document
 * root and sits a few pixels off the bar, so the pointer is briefly over neither — without
 * this grace period the rows close before they can be reached, every time.
 */
const GRACE = 220

export function useHoverFlyout(rowCount: number): HoverFlyout {
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasFlyout = rowCount > 1

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const enter = useCallback(() => {
    cancel()
    setOpen(true)
  }, [cancel])

  // A menu that was asked for is not the pointer's to close. Walking it with the arrows and
  // moving the mouse off the bar is one gesture, not two: closing on the grace period would end
  // the walk 220 ms after a movement that touched nothing, and hand the focus back to the opener.
  // It closes the way a menu closes — a choice, `Escape`, `Tab`, or a press outside.
  const leave = useCallback(() => {
    if (asked) return
    cancel()
    timer.current = setTimeout(() => setOpen(false), GRACE)
  }, [asked, cancel])

  const ask = useCallback(() => {
    cancel()
    setOpen(true)
    setAsked(true)
  }, [cancel])

  const close = useCallback(() => {
    cancel()
    setOpen(false)
    setAsked(false)
  }, [cancel])

  useEffect(() => cancel, [cancel])

  const askedFor = hasFlyout && open && asked

  return {
    hasFlyout,
    showing: hasFlyout && open,
    asked: askedFor,
    wrapProps: { onPointerEnter: enter, onPointerLeave: leave },
    flyoutProps: {
      onPointerEnter: enter,
      onPointerLeave: leave,
      onDismiss: close,
      onKeyClose: askedFor ? close : undefined,
    },
    open: ask,
    close,
  }
}
