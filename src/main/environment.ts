/**
 * Whether the studio is running from the dev server rather than from a packaged bundle.
 *
 * **Not `app.isPackaged`.** Electron derives that flag from the basename of the running
 * executable — anything other than `electron` reads as packaged. `scripts/dev-app-identity.mjs`
 * renames the bundle *and* its executable to the product's name so development shows up under
 * the studio's name and icon instead of Electron's, which makes the flag report a packaged app
 * in the middle of a dev run.
 *
 * That is not cosmetic: it sent the window looking for `out/renderer/index.html`, which a dev
 * run never builds, so the app failed to start at all. Other behaviours switched to their
 * production side with it — DevTools, the log mirror, the Dock icon, the developer menu, the
 * reload shortcut guard, and the single-instance lock, which a dev run does not take: hot
 * reload starts the next process before this one has finished dying.
 *
 * `__DEV__` is injected by `define` at build time, so it says what the build *is* rather than
 * what the executable happens to be called.
 */
export const isDevelopment = __DEV__
