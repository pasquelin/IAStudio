import { utilityProcess } from 'electron'
import { fileURLToPath } from 'node:url'
import { createSttClient, type SttClient, type SttListeners, type SttPort } from './stt-client'
import type { SttResponse } from './stt-protocol'

/** Forks the recognition worker. Who keeps it, and for how long, is `session.ts`'s business. */
export function openSttProcess(listeners: SttListeners, onExit: () => void = () => {}): SttClient {
  // Resolved beside the bundled main, where `stt-worker` is its own entry point — see
  // `electron.vite.config.ts`. Through `import.meta.url`, as `peaks-process` does: the main
  // bundle is ESM, and the `__dirname` that appears in it is a shim Vite injects for an inlined
  // dependency — a reference that would vanish the day that dependency does.
  const child = utilityProcess.fork(fileURLToPath(new URL('./stt-worker.js', import.meta.url)))

  const port: SttPort = {
    postMessage: message => child.postMessage(message),
    onMessage: listener => {
      child.on('message', (response: SttResponse) => listener(response))
    },
    onFailure: listener => {
      // Whatever the code: a clean exit leaves the session as deaf as a crash does.
      child.on('exit', (code: number) => {
        listener(new Error(`the recognition process exited with code ${code}`))
        onExit()
      })
    },
    kill: () => {
      child.kill()
    },
  }

  return createSttClient(port, listeners)
}
