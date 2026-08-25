import type { ContextMenuItem } from '@shared/domain/contextMenu'

/**
 * 🛑 The one rule of `parseContextMenuItems` a window can break on its own, restated here because
 * the renderer may not import from the main process (invariant 2). A submenu with no row makes
 * that parser refuse the WHOLE menu — a right-click on any folder lost its twelve other gestures,
 * silently, and every test stayed green because this double recorded whatever it was handed.
 */
function refuseEmptySubmenu(items: readonly ContextMenuItem[]): void {
  for (const item of items) {
    if (item.submenu && item.submenu.length === 0) {
      throw new Error(`the main process refuses a menu whose « ${item.label} » opens onto nothing`)
    }
  }
}

/** A menu read as one list: a group, then the rows it opens onto. One level, as the type bounds. */
function flattened(items: readonly ContextMenuItem[]): ContextMenuItem[] {
  return items.flatMap(item => [item, ...(item.submenu ?? [])])
}

/**
 * The system's context menu, for tests — what a window asked it to draw, and which row it says
 * was chosen.
 *
 * The choice is declared BEFORE the menu is raised, and it has to be: a native menu is popped by
 * the main process and answers a promise, so there is no rendered row for a test to click on.
 * `picks` is that click, made in advance.
 */
export function fakeMenu() {
  const raised: (readonly ContextMenuItem[])[] = []
  let picked: string | null = null

  return {
    /** Every menu raised, oldest first — a surface that raises two is read row by row. */
    raised,
    /** What the system will report as chosen, by label. `null` dismisses. */
    picks: (label: string | null): void => void (picked = label),
    /** The overrides `installFakeBridge` takes. */
    bridge: {
      popup: (items: readonly ContextMenuItem[]): Promise<string | null> => {
        refuseEmptySubmenu(items)
        raised.push(items)
        // Rows of a submenu are pickable too, and by their own label: a menu of three families
        // has nothing choosable at its top level at all.
        const rows = items.flatMap(item => [item, ...(item.submenu ?? [])])
        return Promise.resolve(rows.find(row => row.label === picked)?.id ?? null)
      },
    },
    /**
     * The labels of the menu last raised, in the order they were sent — a group's own label
     * followed by its rows', which is the order a reader meets them in.
     */
    labels: (): string[] => flattened(raised.at(-1) ?? []).map(item => item.label),
    /** Whether that menu offered the row, or merely showed it — absent when it has no such row. */
    offers: (label: string): boolean | undefined =>
      flattened(raised.at(-1) ?? []).find(item => item.label === label)?.enabled,
  }
}
