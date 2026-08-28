import { Worker } from 'node:worker_threads'
import { threadReady } from '@main/threadReady'
import { createCatalogClient, type AsyncCatalog, type CatalogPort } from './catalogClient'
import { isCatalogReady, type CatalogResponse } from './catalogProtocol'

/**
 * A catalogue running on its own thread.
 *
 * One thread per catalogue, not a pool: SQLite takes one writer at a time, and the queries are
 * short enough that serialising them costs nothing the main thread was not already paying. What
 * the thread buys is that the main process stops waiting for them at all.
 */
export async function openCatalogThread(file: string): Promise<AsyncCatalog> {
  // Resolved against the bundled main, where `catalogWorker` is a second entry point — see
  // `electron.vite.config.ts`. This name is not an import: nothing but a build proves it resolves.
  const worker = new Worker(new URL('./catalogWorker.js', import.meta.url), { workerData: file })

  await threadReady(worker, 'catalogue', isCatalogReady)

  const port: CatalogPort = {
    postMessage: request => worker.postMessage(request),
    onMessage: listener => {
      worker.on('message', (message: CatalogResponse) => {
        listener(message)
      })
    },
    onFailure: listener => {
      worker.on('error', listener)
      // A thread that exits on its own leaves the same callers waiting as one that threw.
      worker.on('exit', (code: number) => {
        if (code !== 0) listener(new Error(`catalogue thread exited with code ${code}`))
      })
    },
    terminate: async () => {
      await worker.terminate()
    },
  }

  return createCatalogClient(port)
}
