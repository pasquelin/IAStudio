import type { UpdateState } from '@shared/domain/update'
import { log } from '@main/log'

/**
 * The slice of `electron-updater`'s `autoUpdater` this module uses.
 *
 * `on` is spelled as overloads rather than a generic over an event map: the real one is generic
 * over ITS map, and two unresolved generics cannot be matched to one another.
 */
export type AutoUpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  logger: {
    info: (message: string) => void
    warn: (message: string) => void
    error: (message: string) => void
  } | null
  on: {
    (event: 'checking-for-update', listener: () => void): unknown
    (event: 'update-available', listener: (info: { version: string }) => void): unknown
    (event: 'update-not-available', listener: () => void): unknown
    (event: 'download-progress', listener: (progress: { percent: number }) => void): unknown
    (event: 'update-downloaded', listener: (info: { version: string }) => void): unknown
    (event: 'error', listener: (failure: Error) => void): unknown
  }
  checkForUpdates: () => Promise<unknown>
  quitAndInstall: () => void
}

type UpdaterPorts = {
  /**
   * Imported on the first check, not at module load: `electron-updater` pulls in semver, js-yaml
   * and all six platform updaters — 30 ms paid before the splash gets its frame, and paid on
   * every dev restart for a code path that immediately gives up.
   */
  loadUpdater: () => Promise<AutoUpdaterLike>
  /** `app.isPackaged`. A development run has no feed and no signature to check against. */
  isPackaged: boolean
  onChange: (state: UpdateState) => void
}

export type Updates = {
  state: () => UpdateState
  check: () => Promise<void>
  install: () => void
}

/**
 * Follows `electron-updater` and turns its events into one state the renderer can render.
 *
 * Downloads on its own but never restarts on its own: interrupting someone mid-generation to
 * install a version they did not ask for is the one thing an updater must not do.
 */
export function createUpdates({ loadUpdater, isPackaged, onChange }: UpdaterPorts): Updates {
  // Unpackaged, `checkForUpdates` throws on a missing app-update.yml before anything else runs.
  if (!isPackaged) {
    log.info('updater', 'Development run: updates are off.')
    return { state: () => ({ phase: 'idle' }), check: async () => {}, install: () => {} }
  }

  let state: UpdateState = { phase: 'idle' }
  // The promise, not the resolved updater: two checks racing the first import would otherwise
  // both load it and register every listener twice, doubling each event on one singleton.
  let connecting: Promise<AutoUpdaterLike> | null = null
  let updater: AutoUpdaterLike | null = null

  const move = (next: UpdateState): void => {
    state = next
    onChange(next)
  }

  const connect = (): Promise<AutoUpdaterLike> => {
    connecting ??= wire()
    return connecting
  }

  const wire = async (): Promise<AutoUpdaterLike> => {
    const autoUpdater = await loadUpdater()
    autoUpdater.logger = {
      info: message => log.info('updater', message),
      warn: message => log.warn('updater', message),
      error: message => log.error('updater', message),
    }
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => move({ phase: 'checking' }))
    autoUpdater.on('update-available', info => move({ phase: 'available', version: info.version }))
    autoUpdater.on('update-not-available', () => move({ phase: 'idle' }))
    autoUpdater.on('download-progress', progress =>
      move({
        phase: 'downloading',
        version: 'version' in state ? state.version : 'unknown',
        progress: Math.min(1, Math.max(0, progress.percent / 100)),
      }),
    )
    autoUpdater.on('update-downloaded', info => move({ phase: 'ready', version: info.version }))
    autoUpdater.on('error', failure => {
      log.error('updater', failure.message)
      move({ phase: 'failed' })
    })

    updater = autoUpdater
    return autoUpdater
  }

  const give = (failure: unknown): void => {
    const reason = failure instanceof Error ? failure.message : 'unknown'
    log.warn('updater', `Could not check for updates: ${reason}`)
    // A load that failed must not poison every later check: a rejected promise cached here
    // would answer instantly and identically for the rest of the session.
    if (!updater) connecting = null
    move({ phase: 'failed' })
  }

  return {
    state: () => state,

    check: async () => {
      // Offline, or a release page answering 404, rejects here rather than through `error`.
      await connect()
        .then(autoUpdater => autoUpdater.checkForUpdates())
        .catch(give)
    },

    install: () => {
      if (state.phase !== 'ready') return
      updater?.quitAndInstall()
    },
  }
}
