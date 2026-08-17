import { utilityProcess } from 'electron'
import { fileURLToPath } from 'node:url'
import { createPeaksClient, type PeaksClient, type PeaksPort } from './peaks-client'
import type { PeaksResponse } from './peaks-protocol'

/** Forks the waveform worker. Who keeps it, and for how long, is `services.ts`'s business. */
export function openPeaksProcess(onExit: () => void = () => {}): PeaksClient {
  // Resolved beside the bundled main, where `peaks-worker` is its own entry point — see
  // `electron.vite.config.ts`. Through `import.meta.url`, as `catalogThread` does: the main
  // bundle is ESM, and the `__dirname` that appears in it is a shim Vite injects for an inlined
  // dependency — a reference that would vanish the day that dependency does.
  const child = utilityProcess.fork(fileURLToPath(new URL('./peaks-worker.js', import.meta.url)))

  const port: PeaksPort = {
    postMessage: message => child.postMessage(message),
    onMessage: listener => {
      child.on('message', (response: PeaksResponse) => listener(response))
    },
    onFailure: listener => {
      // Whatever the code: a clean exit leaves the same callers waiting as a crash.
      child.on('exit', (code: number) => {
        listener(new Error(`waveform process exited with code ${code}`))
        onExit()
      })
    },
  }

  return createPeaksClient(port)
}
