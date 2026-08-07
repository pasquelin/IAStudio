import { utilityProcess } from 'electron'
import { fileURLToPath } from 'node:url'
import { createPeaksClient, type PeaksClient, type PeaksPort } from './peaks-client'
import type { PeaksResponse } from './peaks-protocol'

/**
 * The waveform worker, forked once and kept for the session. One process, not one per file:
 * the ingest pool already bounds how many run at a time, and forking per rush would pay a
 * process launch for every ten seconds of audio.
 *
 * Lazy, because most sessions never import a sound at all.
 */
export function openPeaksProcess(onExit: () => void = () => {}): PeaksClient {
  // Resolved beside the bundled main, where `peaks-worker` is its own entry point — see
  // `electron.vite.config.ts`. Through `import.meta.url`, as `catalog-thread` does: the main
  // bundle is ESM, and the `__dirname` that appears in it is a shim Vite injects for an inlined
  // dependency — a reference that would vanish the day that dependency does.
  const child = utilityProcess.fork(fileURLToPath(new URL('./peaks-worker.js', import.meta.url)))

  const port: PeaksPort = {
    postMessage: message => child.postMessage(message),
    onMessage: listener => {
      child.on('message', (response: PeaksResponse) => listener(response))
    },
    onFailure: listener => {
      // Whatever the exit code: a process that is gone answers nothing, and a clean exit
      // leaves the same callers waiting as a crash. The client rejects them; `onExit` has the
      // next sound fork a new process rather than reject for the rest of the session.
      child.on('exit', (code: number) => {
        listener(new Error(`waveform process exited with code ${code}`))
        onExit()
      })
    },
  }

  return createPeaksClient(port)
}
