import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

/**
 * Whether an input method is still composing the character being typed.
 *
 * Japanese, Chinese and Korean are typed through an IME: several keystrokes build one character,
 * and **Enter is how the writer accepts the candidate on screen**. A field that acts on Enter
 * without asking this steals that key — the rename commits halfway through a word, the message
 * sends while its last character is still being chosen. Escape is the same story, cancelling the
 * composition rather than the field.
 *
 * The interface itself is only offered in French and English, which is beside the point: the
 * language a user TYPES has nothing to do with the language they read. A layer named in Japanese
 * is an ordinary thing to want.
 *
 * Takes either event shape: a field reads the React one, a document-wide listener the native one.
 * Both are needed for the same window — the assistant guards Enter on its textarea while
 * `useDismiss` watches Escape on the document, and a rule applied to one of the two only is the
 * hole this helper exists to close.
 */
export const isComposing = (event: KeyboardEvent | ReactKeyboardEvent): boolean =>
  'nativeEvent' in event ? event.nativeEvent.isComposing : event.isComposing
