import { isDevelopment } from '@main/environment'

/**
 * The permission a page asks for, and where it asks from. Narrower than Electron's own types on
 * purpose: the decision below reads these two values and nothing else.
 */
export type PermissionRequest = { permission: string; origin: string }

/**
 * Whether a permission request is granted.
 *
 * Until dictation there was no handler at all, and Electron's default is to grant everything —
 * so this narrows what the application allows rather than widening it. `media` covers the
 * microphone and the camera together and is the only one the studio has any use for; anything
 * else is a page doing something this application never does.
 *
 * The origin check is the point. `lockNavigation` already keeps a window on its own document,
 * and this is the second lock on the same door: a page that somehow got loaded elsewhere does
 * not get to open the microphone with our signature on the request.
 */
export function grantsPermission(request: PermissionRequest, appOrigin: string): boolean {
  if (request.permission !== 'media') return false
  return request.origin === appOrigin
}

/**
 * An origin, for comparison. Not a whole URL: the renderer navigates within itself by fragment,
 * and a `file://` page reports the opaque `'null'` origin — which is exactly what a packaged
 * build serves, so `'null'` is a legitimate answer here rather than a failure.
 */
export function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return 'null'
  }
}

/**
 * Where the studio's own windows load from — the dev server while watching, the disk once
 * packaged. Read the same way `load` decides what to open, so the two cannot disagree.
 */
export function rendererOrigin(): string {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return isDevelopment && devUrl ? originOf(devUrl) : 'null'
}

/**
 * Installs both handlers on the shared session. The asking one covers `getUserMedia`; the
 * checking one covers what Chromium queries without a prompt, and a page that passed the first
 * while failing the second would be handed a device it is then told it may not have.
 */
export function lockPermissions(session: Electron.Session, appOrigin: string): void {
  session.setPermissionRequestHandler((contents, permission, callback) => {
    callback(grantsPermission({ permission, origin: originOf(contents.getURL()) }, appOrigin))
  })

  // Through `originOf` like the handler above, and for a reason the dev server hides: the two
  // callbacks are not handed the same shape. One gets a URL to normalise, the other Chromium's
  // own serialisation of the origin, which for the `file://` document of a packaged build is not
  // the `'null'` a URL parses to. Compared raw, the check refused what the request had granted —
  // and the microphone labels stayed empty in the only build nobody runs from a terminal.
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    grantsPermission({ permission, origin: originOf(requestingOrigin) }, appOrigin),
  )
}
