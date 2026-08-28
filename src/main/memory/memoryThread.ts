import { Worker } from 'node:worker_threads'
import { createMemoryClient, type AsyncMemory, type MemoryPort } from './memoryClient'
import { isMemoryReady, type MemoryResponse } from './memoryProtocol'

/**
 * A memory running on its own thread.
 *
 * One thread per memory, not a pool: SQLite takes one writer at a time, and what the thread buys
 * is that the main process stops waiting for the file to be read at all.
 */
export async function openMemoryThread(file: string, database: string): Promise<AsyncMemory> {
  // Resolved against the bundled main, where `memoryWorker` is an entry point of its own — see
  // `electron.vite.config.ts`. This name is not an import: nothing but a build proves it resolves.
  const worker = new Worker(new URL('./memoryWorker.js', import.meta.url), {
    workerData: { file, database },
  })

  await ready(worker)

  const port: MemoryPort = {
    postMessage: request => worker.postMessage(request),
    onMessage: listener => {
      worker.on('message', (message: MemoryResponse) => {
        if (!isMemoryReady(message)) listener(message)
      })
    },
    onFailure: listener => {
      worker.on('error', listener)
      // A thread that exits on its own leaves the same callers waiting as one that threw.
      worker.on('exit', (code: number) => {
        if (code !== 0) listener(new Error(`memory thread exited with code ${code}`))
      })
    },
    terminate: async () => {
      await worker.terminate()
    },
  }

  return createMemoryClient(port)
}

/**
 * Waits for the thread to say the file has been read. Without it, a memory whose database cannot
 * be opened would look open until the first query came back.
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
      if (!isMemoryReady(message)) return
      settle(message.ready ? undefined : new Error(message.error))
    }
    const onError = (error: Error): void => settle(error)
    const onExit = (code: number): void =>
      settle(new Error(`memory worker stopped before it opened (code ${code})`))

    worker.on('message', onMessage)
    worker.on('error', onError)
    worker.on('exit', onExit)
  })
}
