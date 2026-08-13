import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/domain/update'
import { type AutoUpdaterLike, createUpdates } from './updater'

type Listener = (payload: never) => void

/** A stand-in for `electron-updater`, keeping its listeners so a test can fire them. */
function fakeUpdater(): AutoUpdaterLike & { fire: (event: string, payload?: unknown) => void } {
  const listeners = new Map<string, Listener>()

  return {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    logger: null,
    on: (event: string, listener: Listener) => listeners.set(event, listener),
    checkForUpdates: vi.fn(() => Promise.resolve(null)),
    quitAndInstall: vi.fn(),
    // `as never`: the listeners are stored behind one type, and firing them is what a real
    // updater does with payloads this fake decides. The overloads guard the production call.
    fire: (event, payload) => listeners.get(event)?.(payload as never),
  }
}

describe('the updater', () => {
  let autoUpdater: ReturnType<typeof fakeUpdater>
  let loadUpdater: () => Promise<AutoUpdaterLike>
  let published: UpdateState[]

  beforeEach(() => {
    autoUpdater = fakeUpdater()
    loadUpdater = vi.fn(() => Promise.resolve(autoUpdater))
    published = []
  })

  /** Packaged and connected: the listeners exist only once a check has been run. */
  const checked = async () => {
    const updates = createUpdates({
      loadUpdater,
      isPackaged: true,
      onChange: state => published.push(state),
    })
    await updates.check()
    return updates
  }

  it('starts out with nothing to say', () => {
    const updates = createUpdates({ loadUpdater, isPackaged: true, onChange: () => {} })

    expect(updates.state()).toEqual({ phase: 'idle' })
  })

  // 30 ms of semver, js-yaml and six platform updaters, paid before the splash gets its frame.
  it('does not load electron-updater until something asks', () => {
    createUpdates({ loadUpdater, isPackaged: true, onChange: () => {} })

    expect(loadUpdater).not.toHaveBeenCalled()
  })

  it('loads it once, however many checks are run', async () => {
    const updates = await checked()
    await updates.check()

    expect(loadUpdater).toHaveBeenCalledTimes(1)
  })

  // Two checks racing the first import would otherwise register every listener twice, on one
  // singleton — each event then published twice.
  it('loads it once even when two checks race the first import', async () => {
    const updates = createUpdates({ loadUpdater, isPackaged: true, onChange: () => {} })

    await Promise.all([updates.check(), updates.check()])
    autoUpdater.fire('update-not-available')

    expect(loadUpdater).toHaveBeenCalledTimes(1)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('downloads on its own but leaves the restart to the user', async () => {
    await checked()

    expect(autoUpdater.autoDownload).toBe(true)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('follows a version from announcement to ready', async () => {
    const updates = await checked()

    autoUpdater.fire('checking-for-update')
    autoUpdater.fire('update-available', { version: '0.2.0' })
    autoUpdater.fire('download-progress', { percent: 40 })
    autoUpdater.fire('update-downloaded', { version: '0.2.0' })

    expect(published).toEqual([
      { phase: 'checking' },
      { phase: 'available', version: '0.2.0' },
      { phase: 'downloading', version: '0.2.0', progress: 0.4 },
      { phase: 'ready', version: '0.2.0' },
    ])
    expect(updates.state()).toEqual({ phase: 'ready', version: '0.2.0' })
  })

  it('carries the version through the download', async () => {
    await checked()

    autoUpdater.fire('update-available', { version: '0.2.0' })
    autoUpdater.fire('download-progress', { percent: 12.5 })

    expect(published.at(-1)).toEqual({ phase: 'downloading', version: '0.2.0', progress: 0.125 })
  })

  it('keeps the ratio inside its bounds', async () => {
    await checked()

    autoUpdater.fire('download-progress', { percent: 140 })

    expect(published.at(-1)).toEqual({ phase: 'downloading', version: 'unknown', progress: 1 })
  })

  it('goes back to idle when the release is already the current one', async () => {
    await checked()

    autoUpdater.fire('update-available', { version: '0.2.0' })
    autoUpdater.fire('update-not-available')

    expect(published.at(-1)).toEqual({ phase: 'idle' })
  })

  it('reports a failed check without throwing', async () => {
    autoUpdater.checkForUpdates = vi.fn(() => Promise.reject(new Error('getaddrinfo ENOTFOUND')))

    await checked()

    expect(published.at(-1)).toEqual({ phase: 'failed' })
  })

  // The module cannot be there at all — a packaged build missing its dependency, or a broken
  // install. Never a crash on the path that opens the window.
  it('survives an updater that will not even load', async () => {
    loadUpdater = vi.fn(() => Promise.reject(new Error('Cannot find module')))

    await checked()

    expect(published.at(-1)).toEqual({ phase: 'failed' })
  })

  it('reports an error raised by the updater itself', async () => {
    await checked()

    autoUpdater.fire('error', new Error('signature mismatch'))

    expect(published.at(-1)).toEqual({ phase: 'failed' })
  })

  // Quitting before the bytes are on disk would restart the app onto the version it already is.
  it('refuses to install anything that is not ready', async () => {
    const updates = await checked()

    autoUpdater.fire('update-available', { version: '0.2.0' })
    updates.install()

    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('installs once the download has landed', async () => {
    const updates = await checked()

    autoUpdater.fire('update-downloaded', { version: '0.2.0' })
    updates.install()

    expect(autoUpdater.quitAndInstall).toHaveBeenCalled()
  })

  describe('in development', () => {
    const unpackaged = () =>
      createUpdates({ loadUpdater, isPackaged: false, onChange: state => published.push(state) })

    // `checkForUpdates` throws on a missing app-update.yml before anything else runs.
    it('never reaches for a feed, nor for the module behind it', async () => {
      await unpackaged().check()

      expect(loadUpdater).not.toHaveBeenCalled()
      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(published).toEqual([])
    })

    it('stays idle, and installs nothing', async () => {
      const updates = unpackaged()
      await updates.check()
      updates.install()

      expect(updates.state()).toEqual({ phase: 'idle' })
      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })
  })

  /**
   * Why `services.ts` reaches the real updater through `default`.
   *
   * `electron-updater` publishes `autoUpdater` with `Object.defineProperty(exports, …, { get })`,
   * built lazily so that loading the module costs nothing. That shape is the whole reason for the
   * indirection, and it is what this checks: `default` is the interop object, getter kept.
   *
   * Read as a descriptor rather than as a value — touching it would build a `MacUpdater`, which
   * wants an Electron `app` that a test runner has no business starting.
   *
   * **The blind spot, and it is the important half**: whether the getter also survives as a NAMED
   * export is decided by the loader, not by the package, and the two loaders disagree. Vite
   * resolves this file's `import` itself and does expose `autoUpdater`; Electron 43's native ESM
   * loader does not, and answers `undefined` — measured on 2026-08-13 with a probe run under the
   * real binary, which is what left the auto-updater dead for every installed copy while writing
   * one log line. No assertion here can see that: the runner is not the runtime. A named read
   * would pass this suite and ship broken, so `no-app-is-packaged.test.ts` guards the flag and
   * this one only pins the shape the wiring depends on.
   */
  it('reaches the real updater through a getter, which is why the wiring goes via default', async () => {
    const electronUpdater = await import('electron-updater')
    const published = Object.getOwnPropertyDescriptor(electronUpdater.default, 'autoUpdater')

    expect(typeof published?.get).toBe('function')
    expect(published?.enumerable).toBe(true)
  })
})
