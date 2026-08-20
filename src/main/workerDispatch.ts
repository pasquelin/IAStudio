/**
 * The message loop a worker process runs: one abort table, a cancel that reaches the run it names,
 * and a failure answered rather than thrown. What differs between workers is the work itself, and
 * how each protocol spells an id, a job and a failure.
 */

type WorkerDispatchOptions<Message extends { id: number }, Job extends Message, Response> = {
  /** Posts an answer to the parent — progress included, which the work sends on its own. */
  reply: (response: Response) => void
  /** A cancel carries no job, and `run` is handed only what does. */
  isJob: (message: Message) => message is Job
  run: (job: Job, signal: AbortSignal) => Promise<Response>
  failed: (id: number, error: unknown) => Response
}

/**
 * Hands back the listener the worker hooks to its parent port. Never throws: one process serves
 * every run at once, so a loop that dies takes them all down, not just the one that caused it.
 */
export function createWorkerDispatch<
  Message extends { id: number },
  Job extends Message,
  Response,
>({
  reply,
  isJob,
  run,
  failed,
}: WorkerDispatchOptions<Message, Job, Response>): (message: Message) => void {
  const running = new Map<number, AbortController>()

  return message => {
    try {
      if (!isJob(message)) {
        running.get(message.id)?.abort()
        return
      }

      const controller = new AbortController()
      running.set(message.id, controller)

      run(message, controller.signal)
        .then(reply, (error: unknown) => reply(failed(message.id, error)))
        .finally(() => running.delete(message.id))
    } catch (error) {
      running.delete(message.id)
      reply(failed(message.id, error))
    }
  }
}
