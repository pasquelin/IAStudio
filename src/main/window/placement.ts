export type WindowArea = { x: number; y: number; width: number; height: number }

/**
 * Where a window of this size sits in the middle of a work area.
 *
 * 🛑 Electron's own `center` reads the display BOUNDS on macOS alone — AppKit centres on the screen
 * frame — so the menu bar and the Dock push the window up by half their height, 96px measured here.
 * On Windows and Linux `Center()` already reads the work area, and this agrees with it.
 */
export function centredIn(area: WindowArea, size: { width: number; height: number }): WindowArea {
  // Clamped, because these windows are frameless and not resizable: taller than the work area,
  // their footer sits off the screen with no way to reach it.
  const width = Math.min(size.width, area.width)
  const height = Math.min(size.height, area.height)

  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
  }
}
