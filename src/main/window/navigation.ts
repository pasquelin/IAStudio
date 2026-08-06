import { app, shell } from 'electron'

/**
 * Locks navigation for every `webContents` the app will ever create.
 *
 * The preload is attached to the **webContents**, not to the document: if the renderer
 * navigates away — a compromised dependency, or an `<a href>` built from an asset name
 * returned by the API — the remote page inherits `window.studio` intact, and the CSP of our
 * `index.html` leaves with the old document. From there it can call `setCredentials` or
 * `generate` on the user's key. Blocking navigation is what keeps the bridge ours.
 */
export function lockNavigation(): void {
  app.on('web-contents-created', (_event, contents) => {
    const stayPut = (event: Electron.Event, url: string): void => {
      if (url !== contents.getURL()) event.preventDefault()
    }

    contents.on('will-navigate', stayPut)
    contents.on('will-frame-navigate', details => stayPut(details, details.url))
    contents.on('will-attach-webview', event => event.preventDefault())
    contents.setWindowOpenHandler(({ url }) => {
      openExternally(url)
      return { action: 'deny' }
    })
  })
}

/**
 * Hands a URL to the system browser — but only over HTTPS. `shell.openExternal` goes to
 * LaunchServices on macOS and ShellExecute on Windows: a `file://` URL launches an
 * application outside the Chromium sandbox, and `smb://` leaks an NTLM hash. The renderer
 * fully controls this string, so the scheme has to be checked here.
 */
export function openExternally(url: string): void {
  try {
    if (new URL(url).protocol === 'https:') void shell.openExternal(url)
  } catch {
    // Not a parseable URL: nothing to open, and nothing worth reporting.
  }
}
