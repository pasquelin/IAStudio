/**
 * Whether a keystroke belongs to a field rather than to the application. Asked by both listeners
 * on `window`: the shortcut hook, and the canvas engine deciding whether a held space pans or
 * types a space. The native menu asks nothing — it delegates with `registerAccelerator: false`.
 *
 * One definition, because the copies had already drifted — only one knew about `<select>`.
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
