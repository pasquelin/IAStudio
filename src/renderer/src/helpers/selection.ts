/**
 * A selection as an ordered list of ids, and what a click does to one.
 *
 * The order carries meaning: **the last id is the anchor** — the one an inspector reads out,
 * the one a gizmo sits on, and the one a range extends from. A set would lose it.
 *
 * One owner for the gesture, because a tree, a list and a viewport all have to answer the same
 * modifiers the same way, and three copies of the rule would drift.
 */

/** How a click composes with what is already selected. */
export type SelectionMode = 'replace' | 'toggle'

/** The keys a pointer or key event carries that change what a click means. */
export type Modifiers = { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }

/** What a click on `id` asks for, given the ids in the order they are drawn. */
export type Pick = { ids: readonly string[]; mode: SelectionMode }

export function applySelection(
  current: readonly string[],
  ids: readonly string[],
  mode: SelectionMode,
): readonly string[] {
  const next = mode === 'replace' ? [...new Set(ids)] : toggled(current, ids)
  // Identity kept when the answer is the one already held: clicking the selected row again, or
  // in the void with nothing selected, must not re-render every panel that watches it.
  return same(current, next) ? current : next
}

function toggled(current: readonly string[], ids: readonly string[]): readonly string[] {
  const next = [...current]
  for (const id of ids) {
    const at = next.indexOf(id)
    // Appended rather than left in place: what was just picked becomes the anchor.
    if (at < 0) next.push(id)
    else next.splice(at, 1)
  }
  return next
}

function same(current: readonly string[], next: readonly string[]): boolean {
  return current.length === next.length && current.every((id, at) => id === next[at])
}

/**
 * The ids between two rows of a list, inclusive, in the order the list draws them — except that
 * the target always ends up last, so it becomes the anchor. A second extend therefore runs from
 * what was clicked rather than from where the first one began.
 */
export function rangeBetween(
  ordered: readonly string[],
  from: string | undefined,
  to: string,
): readonly string[] {
  const end = ordered.indexOf(to)
  if (end < 0) return []

  const start = from === undefined ? -1 : ordered.indexOf(from)
  // No anchor to run from — an extend with nothing selected is just a click.
  if (start < 0) return [to]

  const span = ordered.slice(Math.min(start, end), Math.max(start, end) + 1)
  return start <= end ? span : span.reverse()
}

/**
 * What a click on a row of an ordered list asks for. `ordered` is the rows actually on screen,
 * which is the only place "everything between these two" means anything — so the range is
 * resolved by the list that draws them, never by whoever stores the result.
 */
export function pickFrom(
  ordered: readonly string[],
  anchor: string | undefined,
  id: string,
  modifiers: Modifiers,
): Pick {
  if (modifiers.metaKey || modifiers.ctrlKey) return { ids: [id], mode: 'toggle' }
  if (modifiers.shiftKey) return { ids: rangeBetween(ordered, anchor, id), mode: 'replace' }
  return { ids: [id], mode: 'replace' }
}
