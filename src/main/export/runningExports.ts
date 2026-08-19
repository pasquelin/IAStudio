import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'

/**
 * The exports this process is writing, keyed by the id the WINDOW minted — a name only answered
 * once the file is written would leave the minutes before that unstoppable.
 */
export type RunningExports = {
  /** Runs `work` under an id the window can name, and forgets it whichever way it ends. */
  run: <T>(id: string, work: (signal: AbortSignal) => Promise<T>) => Promise<T>
  /** Stops one. Answers whether there was one — a click that arrives late is not a failure. */
  cancel: (id: string) => boolean
}

export function createRunningExports(): RunningExports {
  const running = new Map<string, AbortController>()

  return {
    run: async (id, work) => {
      // The second export under a live id would have taken over its stop button, so the first
      // becomes unstoppable. The window mints one per row, so this only happens if it breaks.
      if (running.has(id)) throw new Error(`an export is already running under ${id}`)

      const controller = new AbortController()
      running.set(id, controller)
      try {
        return await work(controller.signal)
      } finally {
        running.delete(id)
      }
    },
    cancel: id => {
      const controller = running.get(id)
      controller?.abort()
      return controller !== undefined
    },
  }
}

export function registerExportCancelHandler(running: RunningExports): void {
  handle(CHANNELS.exportCancel, (_event, id) => running.cancel(id))
}
