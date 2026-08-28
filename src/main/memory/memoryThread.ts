import { Worker } from 'node:worker_threads'
import { threadReady } from '@main/threadReady'
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

  await threadReady(worker, 'memory', isMemoryReady)

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
