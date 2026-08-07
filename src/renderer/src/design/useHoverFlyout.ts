import { useCallback, useState } from 'react'

export type HoverFlyout = {
  /** A single row is not a menu: the button acts directly, as map3D's toolbar does. */
  hasFlyout: boolean
  showing: boolean
  wrapProps: { onPointerEnter: () => void; onPointerLeave: () => void }
  close: () => void
}

/**
 * Opens a tool's modes on hover, taken from map3D's `useHoverFlyout`.
 *
 * The row count decides: one mode means the tool has nothing to choose, so hovering must not
 * pop an empty menu in front of the canvas.
 */
export function useHoverFlyout(rowCount: number): HoverFlyout {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const hasFlyout = rowCount > 1

  return {
    hasFlyout,
    showing: hasFlyout && open,
    wrapProps: {
      onPointerEnter: () => setOpen(true),
      onPointerLeave: () => setOpen(false),
    },
    close,
  }
}
