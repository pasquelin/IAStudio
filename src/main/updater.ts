import type { UpdateState } from '@shared/domain/update'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { broadcast } from '@main/ipc/broadcast'
import { log } from '@main/log'

/**
 * The slice of `electron-updater`'s `autoUpdater` this module uses.
 *
 * Declared rather than imported so the logic can be tested without the real one, which reaches
 * for a packaged app, a feed URL and the network the moment it is touched.
 *
 * `on` is spelled as overloads rather than a generic over an event map: the real one is generic
 * over ITS map, and two unresolved generics cannot be matched to one another — TypeScript would
 * only see that our map is missing the events we deliberately ignore. Overloads are checked one
 * instantiation at a time, which is exactly the question being asked.
 *
 * Each payload is narrowed to the fields actually read, so a test can hand over a plain object.
 */
export type AutoUpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  // Nullable because that is how `electron-updater` declares it — one can silence it entirely.
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

export type UpdaterPorts = {
  autoUpdater: AutoUpdaterLike
  /** `app.isPackaged`. A development run has no feed and no signature to check against. */
  isPackaged: boolean
  publish: (state: UpdateState) => void
}

export type Updates = {
  state: () => UpdateState
  check: () => Promise<void>
  install: () => void
}

/**
 * Follows `electron-updater` and turns its events into one state the renderer can render.
 *
 * Downloads on its own but never restarts on its own: the update is applied on the next quit.
 * Interrupting someone mid-generation to install a version they did not ask for is the one
 * thing an updater must not do.
 */
export function createUpdates({ autoUpdater, isPackaged, publish }: UpdaterPorts): Updates {
  let state: UpdateState = { phase: 'idle' }

  const move = (next: UpdateState): void => {
    state = next
    publish(next)
  }

  // Unpackaged, `checkForUpdates` throws on a missing app-update.yml before anything else runs.
  if (!isPackaged) {
    return {
      state: () => state,
      check: async () => {
        log.info('updater', 'Development run: not checking for updates.')
      },
      install: () => {
        log.info('updater', 'Development run: nothing to install.')
      },
    }
  }

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
      // Carried over: the progress payload names bytes and speed, never which version they are.
      version: 'version' in state ? state.version : 'unknown',
      progress: Math.min(1, Math.max(0, progress.percent / 100)),
    }),
  )
  autoUpdater.on('update-downloaded', info => move({ phase: 'ready', version: info.version }))
  autoUpdater.on('error', failure => move({ phase: 'failed', reason: failure.message }))

  return {
    state: () => state,

    check: async () => {
      // Offline, or a release page answering 404, rejects here rather than through `error`.
      await autoUpdater.checkForUpdates().catch((failure: unknown) => {
        move({ phase: 'failed', reason: failure instanceof Error ? failure.message : 'unknown' })
      })
    },

    install: () => {
      if (state.phase !== 'ready') return
      autoUpdater.quitAndInstall()
    },
  }
}

/** Wires the update surface onto the IPC boundary. */
export function registerUpdateHandlers(ports: Omit<UpdaterPorts, 'publish'>): Updates {
  const updates = createUpdates({
    ...ports,
    publish: state => broadcast(EVENTS.updateState, state),
  })

  handle(CHANNELS.updateState, () => updates.state())
  handle(CHANNELS.updateInstall, () => {
    updates.install()
  })

  return updates
}
