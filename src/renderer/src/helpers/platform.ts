/**
 * Which desktop this window runs on. Keyboard shortcuts are the whole reason it is asked: ⌘ is
 * the command key on macOS and Ctrl everywhere else, which is what `CmdOrCtrl` already tells the
 * native menu — the window has to agree with it or every ⌘ command is out of reach off macOS.
 */
export function isMacUserAgent(userAgent: string): boolean {
  return userAgent.includes('Mac')
}

/**
 * Read once, from the user agent rather than over the bridge: a keydown cannot await, and a
 * value arriving one frame late would sign the first chords of a session with the wrong modifier.
 *
 * Under test it is whatever the setup files pin, never the runner's own — see
 * `testSetupStores.ts`, which both renderer projects load.
 */
export const IS_MAC = isMacUserAgent(navigator.userAgent)
