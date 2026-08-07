import { useCallback, useEffect, useRef, useState } from 'react'

export type HoverFlyout = {
  /** A single row is not a menu: the button acts directly, as map3D's toolbar does. */
  hasFlyout: boolean
  showing: boolean
  /** Goes on the button's wrapper. */
  wrapProps: { onPointerEnter: () => void; onPointerLeave: () => void }
  /** Goes on the menu itself — without it, reaching the rows closes them. */
  flyoutProps: { onPointerEnter: () => void; onPointerLeave: () => void }
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

  const leave = useCallback(() => {
    cancel()
    timer.current = setTimeout(() => setOpen(false), GRACE)
  }, [cancel])

  const close = useCallback(() => {
    cancel()
    setOpen(false)
  }, [cancel])

  useEffect(() => cancel, [cancel])

  return {
    hasFlyout,
    showing: hasFlyout && open,
    wrapProps: { onPointerEnter: enter, onPointerLeave: leave },
    flyoutProps: { onPointerEnter: enter, onPointerLeave: leave },
    close,
  }
}
