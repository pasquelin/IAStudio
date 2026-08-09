/**
 * Runs what it is given one at a time, in the order it was given.
 *
 * Written down and tested rather than inlined in the worker, because the bug it exists to
 * prevent killed the recognition process on the first real sentence and no test had seen it:
 * audio arrives every 100 ms, a decode takes several hundred, and `decodeAsync` hands the
 * thread back — so the next chunk started being handled while the previous one was still
 * inside the engine, and two decodes ended up sharing a recogniser built for one.
 */
export type Serial = {
  /** Queues a task. Answers when it has run, whether it settled or threw. */
  run: (task: () => Promise<void>) => Promise<void>
}

export function createSerial(onFailure: (error: unknown) => void): Serial {
  let queue: Promise<void> = Promise.resolve()

  return {
    run: task => {
      // The chain is never allowed to reject: a rejected link would make every task queued
      // behind it fail too, for a reason that has nothing to do with them.
      queue = queue.then(task).catch(onFailure)
      return queue
    },
  }
}
