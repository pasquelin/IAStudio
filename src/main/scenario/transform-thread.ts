import { Worker } from 'node:worker_threads'
import { createTransformClient, type TransformClient, type TransformPort } from './transform-client'
import type { TransformResponse } from './transform-protocol'

/** A CEL evaluator on its own thread, started on the first expression and not before. */
export function openTransformThread(report: (message: string) => void): TransformClient {
  return createTransformClient(portOfWorker, report)
}

function portOfWorker(): TransformPort {
  // Resolved against the bundled main, where `transform-worker` is a second entry point — see
  // `electron.vite.config.ts`, as `catalog-worker` and the other two are.
  const worker = new Worker(new URL('./transform-worker.js', import.meta.url))

  return {
    postMessage: request => worker.postMessage(request),
    onMessage: listener => {
      worker.on('message', (message: TransformResponse) => listener(message))
    },
    onFailure: listener => {
      worker.on('error', listener)
      // A thread that exits on its own leaves the same callers waiting as one that threw.
      worker.on('exit', (code: number) => {
        if (code !== 0) listener(new Error(`evaluator thread exited with code ${code}`))
      })
    },
    // `terminate` resolves once the thread is down; nothing here waits for that, and a rejection
    // on a thread already gone would be an unhandled one.
    terminate: () => void worker.terminate(),
  }
}
