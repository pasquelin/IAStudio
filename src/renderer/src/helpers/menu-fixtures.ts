import type { ContextMenuItem } from '@shared/domain/context-menu'

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
        raised.push(items)
        return Promise.resolve(items.find(item => item.label === picked)?.id ?? null)
      },
    },
    /** The labels of the menu last raised, in the order they were sent. */
    labels: (): string[] => (raised.at(-1) ?? []).map(item => item.label),
    /** Whether that menu offered the row, or merely showed it — absent when it has no such row. */
    offers: (label: string): boolean | undefined =>
      raised.at(-1)?.find(item => item.label === label)?.enabled,
  }
}
