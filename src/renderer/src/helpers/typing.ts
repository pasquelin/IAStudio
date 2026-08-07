/**
 * Whether a keystroke belongs to a field rather than to the application. Asked by everything
 * that listens on `window`: the shortcut hook, the command registry deciding what ⌘Z means, and
 * the canvas engine deciding whether a held space pans or types a space.
 *
 * One definition, because the three had already drifted — only one of them knew about `<select>`.
 */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/** The same question about wherever the caret is, for a listener with no event in hand. */
export function isTypingNow(): boolean {
  return isTyping(document.activeElement)
}
