/** The part of Electron's `before-input-event` payload the reload policy reads. */
export type KeyPress = {
  type: string
  key: string
  control: boolean
  meta: boolean
}

/**
 * `will-navigate` only fires when the URL changes, so `location.reload()` slips past the
 * navigation lock. Not a breach — unsaved editing state lost to a stray ⌘R.
 *
 * Its own module, importing nothing: a file that imports `electron` cannot be tested under
 * plain Node, which is where the main process suites run.
 */
export function isReloadShortcut(input: KeyPress): boolean {
  if (input.type !== 'keyDown') return false
  if (input.key === 'F5') return true
  return input.key.toLowerCase() === 'r' && (input.control || input.meta)
}
