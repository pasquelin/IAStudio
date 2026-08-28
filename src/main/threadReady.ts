import type { Worker } from 'node:worker_threads'

/**
 * Waits for a worker thread to say it has opened whatever it owns.
 *
 * The three `off` before resolving are the whole subtlety: an `exit` arriving after a successful
 * handshake would otherwise settle the promise a second time.
 */
export function threadReady(
  worker: Worker,
  what: string,
  isReady: (message: unknown) => message is { ready: true } | { ready: false; error: string },
): Promise<void> {
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
      if (!isReady(message)) return
      settle(message.ready ? undefined : new Error(message.error))
    }
    const onError = (error: Error): void => settle(error)
    const onExit = (code: number): void =>
      settle(new Error(`the ${what} thread stopped before it opened (code ${code})`))

    worker.on('message', onMessage)
    worker.on('error', onError)
    worker.on('exit', onExit)
  })
}
