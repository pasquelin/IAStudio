import { useEffect, useRef, type RefObject } from 'react'

/** The three roles a menu row can carry. The keyboard walks all of them alike. */
const ROWS = '[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"]'

/**
 * The manners a menu owes a keyboard: focus lands on the first row when it opens, the arrows
 * walk the rows, and focus goes back where it came from when it closes.
 *
 * Beside `useDismiss` rather than inside it: dismissing is about the three ways a surface goes
 * away, and this is about the one way it is used. A surface can want either without the other —
 * the flyouts that open on hover take dismissal and would fight for the focus.
 *
 * **Roving `tabindex`**, which is the part that is easy to get wrong: a menu is ONE stop in the
 * tab sequence, not one per row. Rows are `<button>`s, so they are all tabbable by default; the
 * hook drives that itself and `MenuRow` never writes `tabIndex`, so React has nothing to undo.
 *
 * `Tab` closes rather than walking the rows — the pattern APG names, and the alternative is a
 * trap someone can only leave by guessing at `Escape`.
 *
 * Pass `undefined` to opt out entirely, the way `useDismiss` does: a surface that opens under
 * the pointer would take the focus from whatever was being typed, and take it back on the way
 * out. A menu without a close has no `Tab` either, which is the trap this hook exists to avoid.
 */
export function useMenuKeys(
  surface: RefObject<HTMLElement | null>,
  onClose: (() => void) | undefined,
): void {
  // Read at event time, never a dependency: every caller passes an inline arrow, so depending on
  // it would tear the effect down on each render of the parent — and put focus back on the first
  // row every time, mid-walk. Only its PRESENCE is a dependency, since that is the opt-in.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  const wanted = Boolean(onClose)

  useEffect(() => {
    const menu = surface.current
    if (!menu || !wanted) return

    // Whatever had focus when the menu opened — the row that was right-clicked, usually.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    // Re-read on every press: a menu whose rows depend on state can gain or lose one while open,
    // and an index taken once would then walk to a row that is no longer there.
    const rows = (): HTMLElement[] =>
      [...menu.querySelectorAll<HTMLElement>(ROWS)].filter(row => !row.hasAttribute('disabled'))

    const focus = (row: HTMLElement | undefined): void => {
      if (!row) return
      for (const other of rows()) other.tabIndex = other === row ? 0 : -1
      row.focus()
    }

    focus(rows()[0])

    const onKeyDown = (event: KeyboardEvent): void => {
      const all = rows()
      if (all.length === 0) return

      const at = all.findIndex(row => row === document.activeElement)
      // A press with focus nowhere in the list starts at the top, whichever direction it asked
      // for: `-1 + 1` is already 0, and `-1 - 1` has to be brought back.
      const last = all.length - 1

      if (event.key === 'ArrowDown') focus(all[at === last ? 0 : at + 1])
      else if (event.key === 'ArrowUp') focus(all[at <= 0 ? last : at - 1])
      else if (event.key === 'Home') focus(all[0])
      else if (event.key === 'End') focus(all[last])
      else if (event.key === 'Tab') close.current?.()
      else return

      event.preventDefault()
    }

    menu.addEventListener('keydown', onKeyDown)

    return () => {
      menu.removeEventListener('keydown', onKeyDown)

      // `body` counts as the menu still holding it, and that is the ordinary case rather than
      // the edge one: this runs AFTER React has taken the rows out, so the row that had focus
      // is already gone and the document has fallen back to `body`. Testing only for a focus
      // still inside the menu never restored anything.
      //
      // What the pair rules out is the other way a menu closes: a press somewhere else, which
      // leaves focus on what was pressed — pulling it back would undo that very gesture.
      const focused = document.activeElement
      if (focused === document.body || menu.contains(focused)) opener?.focus()
    }
  }, [surface, wanted])
}
