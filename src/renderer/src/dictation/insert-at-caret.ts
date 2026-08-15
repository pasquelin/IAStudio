/**
 * Writes text into whatever field the caret is in.
 *
 * This is what makes dictation work everywhere without a single field being rewritten. A
 * wrapper component would have meant touching every input the studio has — the generator's
 * form, the asset search, inline renaming, the settings screens — and each of them differently.
 *
 * The write goes through the property setter React overrode, then through an `input` event that
 * bubbles: react-hook-form, zustand-backed fields and plain uncontrolled inputs all hear it,
 * and none of them knows dictation exists.
 */

type Editable = HTMLInputElement | HTMLTextAreaElement

/**
 * Fields a caret can sit in and text can be written to. A checkbox is neither.
 *
 * `number` and `email` are deliberately absent, though a caret does sit in them: they do not
 * support the selection API, so `setSelectionRange` throws `InvalidStateError` — after the value
 * has been assigned and before the `input` event is dispatched. Dictating into the generator's
 * Seed field wiped it (a `number` input drops anything non-numeric) and told no one, since the
 * event React listens for never fired. Refusing writes nothing, which is the lesser of the two.
 */
const TYPED = ['text', 'search', 'url', 'tel', 'password']

export function editableOf(element: Element | null): Editable | null {
  if (element instanceof HTMLTextAreaElement) return element
  if (element instanceof HTMLInputElement && TYPED.includes(element.type)) return element
  return null
}

/**
 * Assigns through the prototype's own setter.
 *
 * React installs its own `value` setter on the element to know when it changed. Writing
 * `element.value = …` goes through that override, which updates the DOM and leaves React's
 * copy of the value untouched — the next render puts the old text straight back.
 */
function assign(element: Editable, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set

  if (setter) setter.call(element, value)
  else element.value = value
}

/**
 * Inserts at the caret, replacing the selection if there is one, and leaves the caret after
 * what was written — where someone who had just typed it would expect it.
 *
 * A space is added when the text lands right after a word, and not otherwise: dictating two
 * sentences in a row should read as two sentences, not astwo.
 */
export function insertInto(element: Editable, text: string): void {
  if (!text) return

  const start = element.selectionStart ?? element.value.length
  const end = element.selectionEnd ?? start
  const before = element.value.slice(0, start)
  const after = element.value.slice(end)

  const spaced = before.length > 0 && !/\s$/.test(before) ? ` ${text}` : text
  assign(element, `${before}${spaced}${after}`)

  const caret = start + spaced.length
  element.setSelectionRange(caret, caret)

  // Bubbling, so a listener on a form or on the document hears it — which is where
  // react-hook-form and every controlled field listen.
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Inserts into the field that currently has the caret, and says whether it found one.
 *
 * Answers `false` rather than guessing when the focus is elsewhere: writing a sentence into a
 * field nobody was looking at is worse than not writing it.
 */
export function insertAtCaret(text: string, root: Document = document): boolean {
  // Every window receives the sentence, because the event is broadcast — and a document keeps
  // its `activeElement` after its window loses focus. Without this the phrase landed in two
  // fields at once, one of them behind whatever the user was actually looking at.
  if (!root.hasFocus()) return false

  const element = editableOf(root.activeElement)
  if (!element) return false

  insertInto(element, text)
  return true
}
