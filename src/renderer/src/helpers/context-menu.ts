import type { ContextMenuItem } from '@shared/domain/context-menu'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { menuIcon } from './menu-icon'

export type ContextMenuRow = {
  /** Already translated: this side owns the bundle, and the system only draws what it is given. */
  label: string
  /** An `@mdi/js` path, the same one `UiIcon` would draw. */
  icon?: string
  /** Greyed rather than dropped — a menu whose length follows the selection cannot be learnt. */
  disabled?: boolean
  /**
   * What the row does, already translated. **Required**, exactly as `MenuRow` and `ToolButton`
   * require theirs: the system only shows it on macOS, but a row whose explanation was never
   * written has none to show anywhere — and it is a menu the studio can no longer inspect on
   * screen, so the compiler is the only thing left to ask for it.
   */
  tooltip: string
  onSelect: () => void
}

/**
 * Raises the rows as the system's own context menu, at the pointer, and runs the one chosen.
 *
 * Rows are addressed by their position, which is what lets a caller write them as it always
 * has — a list built in place, with the conditions it already had. Nothing needs an id of its
 * own for a menu that lives for as long as one press.
 *
 * **Where the menu appears is not this side's business.** The system pops it at the pointer and
 * keeps it clear of the screen edges, which is the reason for going through the main process
 * rather than drawing a surface: a menu drawn in the window is bounded by the window.
 *
 * Does nothing without a bridge, which is a plain browser and every test that does not double
 * it: a menu that cannot be popped is a menu nobody chose from.
 */
export async function showContextMenu(rows: readonly ContextMenuRow[]): Promise<void> {
  const items: ContextMenuItem[] = rows.map((row, index) => {
    const icon = row.icon ? menuIcon(row.icon) : undefined
    return {
      id: String(index),
      label: row.label,
      enabled: !row.disabled,
      ...(icon ? { icon } : {}),
      tooltip: row.tooltip,
    }
  })

  // Caught rather than left to `void`: the main process validates what arrives and REFUSES what
  // it cannot draw, and a menu that never appears leaves no half-open surface behind to hint at
  // it — an unhandled rejection would be the only trace, and it is not one anybody reads.
  const chosen = await getBridge()
    ?.menu.popup(items)
    .catch(error => {
      reportFailure('shell.menu', rows[0]?.label ?? '', error)
      return null
    })

  // Spelt out rather than `!chosen`: the first row's id is `'0'`, which reads as falsy to anyone
  // skimming even though the string is not.
  if (chosen === null || chosen === undefined) return

  rows[Number(chosen)]?.onSelect()
}
