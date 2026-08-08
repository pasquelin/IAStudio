import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/domain/update'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { type AutoUpdaterLike, createUpdates, registerUpdateHandlers } from './updater'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

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
  let published: UpdateState[]

  beforeEach(() => {
    resetHandlers()
    autoUpdater = fakeUpdater()
    published = []
  })

  const packaged = () =>
    createUpdates({ autoUpdater, isPackaged: true, publish: state => published.push(state) })

  it('starts out with nothing to say', () => {
    expect(packaged().state()).toEqual({ phase: 'idle' })
  })

  it('downloads on its own but leaves the restart to the user', () => {
    packaged()

    expect(autoUpdater.autoDownload).toBe(true)
    expect(autoUpdater.autoInstallOnAppQuit).toBe(true)
  })

  it('follows a version from announcement to ready', () => {
    const updates = packaged()

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

  // The progress payload names bytes and speed, never which version they belong to.
  it('carries the version through the download', () => {
    packaged()

    autoUpdater.fire('update-available', { version: '0.2.0' })
    autoUpdater.fire('download-progress', { percent: 12.5 })

    expect(published.at(-1)).toEqual({ phase: 'downloading', version: '0.2.0', progress: 0.125 })
  })

  it('keeps the ratio inside its bounds', () => {
    packaged()

    autoUpdater.fire('download-progress', { percent: 140 })

    expect(published.at(-1)).toEqual({ phase: 'downloading', version: 'unknown', progress: 1 })
  })

  it('goes back to idle when the release is already the current one', () => {
    packaged()

    autoUpdater.fire('update-available', { version: '0.2.0' })
    autoUpdater.fire('update-not-available')

    expect(published.at(-1)).toEqual({ phase: 'idle' })
  })

  it('reports a failed check without throwing', async () => {
    autoUpdater.checkForUpdates = vi.fn(() => Promise.reject(new Error('getaddrinfo ENOTFOUND')))

    await packaged().check()

    expect(published.at(-1)).toEqual({ phase: 'failed', reason: 'getaddrinfo ENOTFOUND' })
  })

  it('reports an error raised by the updater itself', () => {
    packaged()

    autoUpdater.fire('error', new Error('signature mismatch'))

    expect(published.at(-1)).toEqual({ phase: 'failed', reason: 'signature mismatch' })
  })

  // Quitting before the bytes are on disk would restart the app onto the version it already is.
  it('refuses to install anything that is not ready', () => {
    const updates = packaged()

    autoUpdater.fire('update-available', { version: '0.2.0' })
    updates.install()

    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('installs once the download has landed', () => {
    const updates = packaged()

    autoUpdater.fire('update-downloaded', { version: '0.2.0' })
    updates.install()

    expect(autoUpdater.quitAndInstall).toHaveBeenCalled()
  })

  describe('in development', () => {
    const unpackaged = () =>
      createUpdates({ autoUpdater, isPackaged: false, publish: state => published.push(state) })

    // `checkForUpdates` throws on a missing app-update.yml before anything else runs.
    it('never reaches for a feed', async () => {
      await unpackaged().check()

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(published).toEqual([])
    })

    it('subscribes to nothing, so no event can move it', () => {
      const updates = unpackaged()

      autoUpdater.fire('update-downloaded', { version: '0.2.0' })

      expect(updates.state()).toEqual({ phase: 'idle' })
    })

    it('installs nothing', () => {
      unpackaged().install()

      expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    })
  })

  describe('on the IPC boundary', () => {
    it('answers the state it holds', () => {
      registerUpdateHandlers({ autoUpdater, isPackaged: true })
      autoUpdater.fire('update-downloaded', { version: '0.2.0' })

      expect(invoke(CHANNELS.updateState)).toEqual({ phase: 'ready', version: '0.2.0' })
    })

    it('installs through its channel', () => {
      registerUpdateHandlers({ autoUpdater, isPackaged: true })
      autoUpdater.fire('update-downloaded', { version: '0.2.0' })

      invoke(CHANNELS.updateInstall)

      expect(autoUpdater.quitAndInstall).toHaveBeenCalled()
    })
  })
})
