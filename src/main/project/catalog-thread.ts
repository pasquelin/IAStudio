import { Worker } from 'node:worker_threads'
import { createCatalogClient, type AsyncCatalog, type CatalogPort } from './catalog-client'
import { isCatalogReady, type CatalogResponse } from './catalog-protocol'

/**
 * A catalogue running on its own thread.
 *
 * One thread per catalogue, not a pool: SQLite takes one writer at a time, and the queries are
 * short enough that serialising them costs nothing the main thread was not already paying. What
 * the thread buys is that the main process stops waiting for them at all.
 */
export async function openCatalogThread(file: string): Promise<AsyncCatalog> {
  // Resolved against the bundled main, where `catalog-worker` is a second entry point — see
  // `electron.vite.config.ts`.
  const worker = new Worker(new URL('./catalog-worker.js', import.meta.url), { workerData: file })

  await ready(worker)

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

/**
 * Waits for the thread to say the database is open. Without it, a project whose catalogue
 * cannot be opened would look opened until the first query came back — and `ProjectStore`
 * swaps the current project on the strength of this promise.
 */
function ready(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const settle = (error?: Error): void => {
      worker.off('message', onMessage)
      worker.off('error', onError)
      worker.off('exit', onExit)
      if (error) {
        void worker.terminate()
        reject(error)
      } else resolve()
    }

    const onMessage = (message: unknown): void => {
      if (!isCatalogReady(message)) return
      settle(message.ready ? undefined : new Error(message.error))
    }
    const onError = (error: Error): void => settle(error)
    const onExit = (code: number): void =>
      settle(new Error(`catalog worker stopped before it opened (code ${code})`))

    worker.on('message', onMessage)
    worker.on('error', onError)
    worker.on('exit', onExit)
  })
}
