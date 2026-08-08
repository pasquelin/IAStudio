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

    expect(published.at(-1)).toEqual({ phase: 'failed', reason: 'getaddrinfo ENOTFOUND' })
  })

  // The module cannot be there at all — a packaged build missing its dependency, or a broken
  // install. Never a crash on the path that opens the window.
  it('survives an updater that will not even load', async () => {
    loadUpdater = vi.fn(() => Promise.reject(new Error('Cannot find module')))

    await checked()

    expect(published.at(-1)).toEqual({ phase: 'failed', reason: 'Cannot find module' })
  })

  it('reports an error raised by the updater itself', async () => {
    await checked()

    autoUpdater.fire('error', new Error('signature mismatch'))

    expect(published.at(-1)).toEqual({ phase: 'failed', reason: 'signature mismatch' })
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
})
