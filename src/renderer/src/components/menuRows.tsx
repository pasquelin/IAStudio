import { MenuRow, type MenuRowBase, type MenuRowChoice } from './MenuRow'

/**
 * One row of a menu, as data.
 *
 * `key` and what a select DOES are the two the JSX form could not hand over: a list built by `map`
 * needs the first, and the second has to dismiss the menu it was picked from — which is the host's
 * own `close`, never the row's.
 */
export type MenuRowSpec = Omit<MenuRowBase, 'onSelect'> &
  MenuRowChoice & { key: string; onSelect: (close: () => void) => void }

/**
 * Draws a menu from its rows, so the button that opens it COUNTS them rather than being told a
 * figure: `rowCount` decides whether there is a flyout at all, and three menus of the studio kept
 * that number by hand.
 */
export function renderMenuRows(specs: readonly MenuRowSpec[], close: () => void) {
  return specs.map(({ key, onSelect, ...row }) => (
    <MenuRow key={key} {...row} onSelect={() => onSelect(close)} />
  ))
}
