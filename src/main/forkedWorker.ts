import { utilityProcess } from 'electron'
import { fileURLToPath } from 'node:url'

/** A forked worker, reduced to what a client needs — injected, since forking needs a live app. */
type ForkedWorker<Message, Response> = {
  postMessage: (message: Message) => void
  onMessage: (listener: (response: Response) => void) => void
  /** The process died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
  kill: () => void
}

type ForkedWorkerOptions = {
  /**
   * The entry, resolved by the caller as `new URL('./itsWorker.js', import.meta.url)`: each worker
   * is an entry point of its own beside the bundled main (see `electron.vite.config.ts`), and the
   * `__dirname` that appears there is a shim Vite injects for an inlined dependency.
   */
  entry: URL
  /**
   * Names the process in the error every waiting caller is given when it exits. Never `label`:
   * `main/no-hardcoded-text.test.ts` reads that field as a native menu item's, and this word
   * reaches no screen — it is the technical name of a process, in English, in a log line.
   */
  processName: string
  /** Told the process is gone, so whoever holds this worker can drop it. */
  onExit?: () => void
}

export function openForkedWorker<Message, Response>({
  entry,
  processName,
  onExit = () => {},
}: ForkedWorkerOptions): ForkedWorker<Message, Response> {
  const child = utilityProcess.fork(fileURLToPath(entry))

  return {
    postMessage: message => child.postMessage(message),
    onMessage: listener => {
      child.on('message', (response: Response) => listener(response))
    },
    onFailure: listener => {
      // Whatever the code: a clean exit leaves the same callers waiting as a crash.
      child.on('exit', (code: number) => {
        listener(new Error(`${processName} exited with code ${code}`))
        onExit()
      })
    },
    kill: () => {
      child.kill()
    },
  }
}
