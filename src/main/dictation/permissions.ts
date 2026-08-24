/** Whether the operating system will let this application record. */
export type MicrophoneAccess = 'granted' | 'denied' | 'unknown'

/**
 * What this module needs from Electron and the platform, injected so the decisions below can be
 * tested: `systemPreferences` and `session` both need a running application, which no test has.
 */
export type MicrophoneHost = {
  platform: NodeJS.Platform
  /** macOS only. `'not-determined'` on the first run, and it is the answer that matters. */
  status: () => string
  /** Shows the system prompt, once ever. Later calls answer from what was decided then. */
  ask: () => Promise<boolean>
}

/**
 * Asks the operating system for the microphone, before the renderer ever calls `getUserMedia`.
 *
 * On macOS the order matters: `getUserMedia` on a permission that is still undecided shows the
 * prompt from inside Chromium and answers with a failure that looks like a missing device.
 * Asking first means the interface can tell "you said no" from "there is no microphone".
 */
export async function requestMicrophone(host: MicrophoneHost): Promise<MicrophoneAccess> {
  if (host.platform !== 'darwin') return 'unknown'

  const current = host.status()
  if (current === 'granted') return 'granted'
  // Refused once, and macOS never prompts again: only the system settings can undo it, which
  // is why the interface offers to open them rather than a button that would do nothing.
  if (current === 'denied' || current === 'restricted') return 'denied'

  return (await host.ask()) ? 'granted' : 'denied'
}

/**
 * The system screen where microphone access is granted back after a refusal. macOS only —
 * elsewhere there is no single screen to point at, and the interface says so instead.
 *
 * The address is written here rather than passed in: a renderer that could name what gets
 * opened would be a renderer that can open anything, which is what `openExternally` guards
 * against for every other URL.
 */
const MACOS_MICROPHONE_SETTINGS =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'

/** Opens the screen where microphone access is granted back after a refusal. */
export function openMicrophoneSettings(open: (url: string) => void): void {
  open(MACOS_MICROPHONE_SETTINGS)
}
