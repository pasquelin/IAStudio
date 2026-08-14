/**
 * One row of a context menu the system draws on a window's behalf.
 *
 * **The label arrives already translated**, unlike everything the main process builds for
 * itself. A right-click menu is raised by a window, and that window is the only side holding
 * the state its rows describe — whether a destination is open, whether a transfer is running,
 * how many intents an asset has. Sending a key would mean sending that state across too, and
 * answering the same question on both sides.
 */
export type ContextMenuItem = {
  /** Answered back when the row is chosen, so it has to be unique within one menu. */
  id: string
  label: string
  /**
   * Greyed rather than dropped, the rule every menu of this studio already follows: a menu whose
   * length changes with the selection is one nobody can learn. Absent means enabled.
   */
  enabled?: boolean
  /**
   * A PNG data URL, drawn by the window from its own icon set — `nativeImage` reads no SVG, and
   * the icons of this studio are `@mdi/js` path strings. Absent draws a row without a glyph.
   */
  icon?: string
  /**
   * What the row DOES, as `MenuRow` demands of every row drawn in a window — "tout bouton
   * explique son action". Shown on hover by macOS alone: `MenuItem.toolTip` is documented as
   * macOS-only and the other platforms drop it in silence, so it is sent for every row and lands
   * where it can. Losing it on Windows and Linux is the price of a menu the system draws.
   */
  tooltip?: string
}

/** How wide the window draws a menu icon, in device pixels: a 16 pt row at `@2x`. */
export const MENU_ICON_SIZE = 32
