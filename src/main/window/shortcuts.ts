/** The part of Electron's `before-input-event` payload the reload policy reads. */
export type KeyPress = {
  type: string
  key: string
  control: boolean
  meta: boolean
  alt: boolean
}

/** `location.reload()` keeps the URL, so it slips past the navigation lock untouched. */
export function isReloadShortcut(input: KeyPress): boolean {
  if (input.type !== 'keyDown') return false
  if (input.key === 'F5') return true
  // `!alt` excludes AltGr, which Windows reports as Ctrl+Alt: AltGr+R types a character on
  // Polish, Hungarian and Croatian layouts, and swallowing it would break their keyboard.
  return input.key.toLowerCase() === 'r' && !input.alt && (input.control || input.meta)
}
