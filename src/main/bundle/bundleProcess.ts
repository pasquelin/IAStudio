import { utilityProcess } from 'electron'
import { fileURLToPath } from 'node:url'
import { createBundleClient, type BundleClient, type BundlePort } from './bundleClient'
import type { BundleResponse } from './bundleProtocol'

/** Forks the bundle worker. Who keeps it, and for how long, is `services.ts`'s business. */
export function openBundleProcess(onExit: () => void = () => {}): BundleClient {
  // Resolved beside the bundled main, where `bundleWorker` is its own entry point — see
  // `electron.vite.config.ts`. Through `import.meta.url`, as the waveform's does: the main bundle
  // is ESM, and the `__dirname` in it is a shim Vite injects for an inlined dependency.
  const child = utilityProcess.fork(fileURLToPath(new URL('./bundleWorker.js', import.meta.url)))

  const port: BundlePort = {
    postMessage: message => child.postMessage(message),
    onMessage: listener => {
      child.on('message', (response: BundleResponse) => listener(response))
    },
    onFailure: listener => {
      // Whatever the code: a clean exit leaves the same callers waiting as a crash.
      child.on('exit', (code: number) => {
        listener(new Error(`bundle process exited with code ${code}`))
        onExit()
      })
    },
  }

  return createBundleClient(port)
}
