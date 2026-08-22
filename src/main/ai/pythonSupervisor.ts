import { log } from '@main/log'
import type { PythonClient, PythonListeners } from './pythonClient'

/**
 * Keeps one engine alive, and stops trying when it will not stay. Not the engine's own
 * `core/supervisor.py`, which is the loop INSIDE the process: this is the lifecycle around it.
 */

/** Three deaths inside a minute is an engine that will not run here, not an engine having a bad day. */
export const MAX_FAILURES = 3
export const FAILURE_WINDOW_MS = 60_000

/** Doubling from half a second, capped: an engine that needs a minute needs a person, not a timer. */
export const BACKOFF_BASE_MS = 500
const BACKOFF_CAP_MS = 30_000

/**
 * Injected rather than reached for: a restart budget measured in minutes cannot be tested against
 * a clock that actually turns — the same reason `SessionHost` hands the dictation its own.
 */
export type PythonSupervisorHost = {
  open: (listeners: PythonListeners) => PythonClient
  now: () => number
  delay: (ms: number) => Promise<void>
}

export type PythonSupervisor = {
  /** The engine, started on first ask. `null` once it has died too often to keep trying. */
  engine: () => Promise<PythonClient | null>
  /** Drops the engine and everything it holds. Called when the application is going away. */
  dispose: () => void
}

export function createPythonSupervisor(host: PythonSupervisorHost): PythonSupervisor {
  let client: PythonClient | null = null
  let gaveUp = false
  /** Shared by every caller that arrives while one start is still running. */
  let starting: Promise<PythonClient | null> | null = null
  /** Set by `dispose` while a start is in flight: what arrives after it must not be held. */
  let disposed = false
  let failures: number[] = []

  const recentFailures = (): number => {
    failures = failures.filter(at => at >= host.now() - FAILURE_WINDOW_MS)
    return failures.length
  }

  const died = (error: Error): void => {
    // The client has already killed the port; what is left is to forget it and count the death.
    client = null
    failures.push(host.now())
    log.error('engine', `the local AI engine died: ${error.message}`)
  }

  const start = async (): Promise<PythonClient | null> => {
    for (let recent = recentFailures(); recent < MAX_FAILURES; recent = recentFailures()) {
      if (recent > 0)
        await host.delay(Math.min(BACKOFF_BASE_MS * 2 ** (recent - 1), BACKOFF_CAP_MS))

      const attempt = host.open({ onFailure: died })
      try {
        await attempt.ready
        // An engine that greeted after the studio asked to go away is one nobody will ever close.
        if (disposed) {
          attempt.close()
          return null
        }

        client = attempt
        return attempt
      } catch (error) {
        failures.push(host.now())
        log.warn('engine', `the local AI engine did not start: ${String(error)}`)
      }
    }

    // Said rather than looped on: an engine that dies on its handshake would otherwise be forked
    // again by every caller, for as long as anyone asks for a model.
    gaveUp = true
    log.error('engine', `the local AI engine failed ${MAX_FAILURES} times over; it is not ready`)
    return null
  }

  return {
    engine: () => {
      if (client) return Promise.resolve(client)
      if (gaveUp) return Promise.resolve(null)
      if (starting) return starting

      disposed = false
      starting = start().finally(() => {
        starting = null
      })
      return starting
    },

    dispose: () => {
      disposed = true
      client?.close()
      client = null
    },
  }
}
