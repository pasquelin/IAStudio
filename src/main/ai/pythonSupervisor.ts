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

type EngineState = 'idle' | 'starting' | 'ready' | 'unavailable'

export function createPythonSupervisor(host: PythonSupervisorHost): PythonSupervisor {
  let state: EngineState = 'idle'
  let client: PythonClient | null = null
  /** Shared by every caller that arrives while one start is still running. */
  let starting: Promise<PythonClient | null> | null = null
  let failures: number[] = []

  const recentFailures = (): number => {
    failures = failures.filter(at => at >= host.now() - FAILURE_WINDOW_MS)
    return failures.length
  }

  const died = (error: Error): void => {
    // The client has already killed the port; what is left is to forget it and count the death.
    client = null
    failures.push(host.now())
    if (state !== 'unavailable') state = 'idle'
    log.error('engine', `the local AI engine died: ${error.message}`)
  }

  const start = async (): Promise<PythonClient | null> => {
    while (recentFailures() < MAX_FAILURES) {
      const attempts = failures.length
      if (attempts > 0)
        await host.delay(Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_CAP_MS))

      const attempt = host.open({ onFailure: died })
      try {
        await attempt.ready
        client = attempt
        state = 'ready'
        return attempt
      } catch (error) {
        failures.push(host.now())
        log.warn('engine', `the local AI engine did not start: ${String(error)}`)
      }
    }

    // Said rather than looped on: an engine that dies on its handshake would otherwise be forked
    // again by every caller, for as long as anyone asks for a model.
    state = 'unavailable'
    log.error('engine', `the local AI engine failed ${MAX_FAILURES} times over; it is not ready`)
    return null
  }

  return {
    engine: () => {
      if (client) return Promise.resolve(client)
      if (state === 'unavailable') return Promise.resolve(null)
      if (starting) return starting

      state = 'starting'
      starting = start().finally(() => {
        starting = null
      })
      return starting
    },

    dispose: () => {
      client?.close()
      client = null
      if (state !== 'unavailable') state = 'idle'
    },
  }
}
