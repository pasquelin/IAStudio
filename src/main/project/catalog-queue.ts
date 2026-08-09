import type { Catalog } from './catalog'
import { dispatchCatalogRequest } from './catalog-dispatch'
import {
  ABANDONED,
  isAbandon,
  type CatalogMessage,
  type CatalogRequest,
  type CatalogResponse,
} from './catalog-protocol'

export type CatalogQueue = {
  /** Takes one message. A request is queued; an abandon marks one that has not run yet. */
  accept: (message: CatalogMessage) => void
}

export type CatalogQueueOptions = {
  run: (request: CatalogRequest) => CatalogResponse
  answer: (response: CatalogResponse) => void
  /**
   * How the queue yields between two requests. A turn of the loop, so the messages already
   * delivered — the abandons among them — are seen before the next one is run.
   */
  yieldTo: (resume: () => void) => void
}

/**
 * The thread's message loop, apart from the thread so it can be tested without one.
 *
 * One request per turn rather than the whole queue in a batch, and that is the entire point: a
 * `better-sqlite3` query cannot be interrupted once begun, so the only ones an abandon can save
 * are those still waiting. Draining the queue in one go would run all six searches of six
 * keystrokes before ever reading the five abandons that followed them.
 */
export function createCatalogQueue({ run, answer, yieldTo }: CatalogQueueOptions): CatalogQueue {
  const queue: CatalogRequest[] = []
  const abandoned = new Set<number>()
  let running = false

  const step = (): void => {
    const request = queue.shift()
    if (!request) {
      running = false
      return
    }

    // Answered rather than dropped: the caller has stopped waiting, but a thread that silently
    // eats a request leaves anyone who did not abandon it holding a promise forever.
    if (abandoned.delete(request.id)) answer({ id: request.id, ok: false, error: ABANDONED })
    else answer(run(request))

    yieldTo(step)
  }

  return {
    accept: message => {
      if (isAbandon(message)) {
        // Kept even when the queue no longer holds it: the answer is already on its way, and a
        // set that grew for every abandon would be a leak for the life of the project.
        if (queue.some(request => request.id === message.target)) abandoned.add(message.target)
        return
      }

      queue.push(message)
      if (running) return
      running = true
      yieldTo(step)
    },
  }
}

/** The thread's end of the port, reduced to what serving a catalogue needs. */
export type CatalogServerPort = {
  postMessage: (response: CatalogResponse) => void
  on: (event: 'message', listener: (message: CatalogMessage) => void) => void
}

/**
 * A catalogue answering on a port. Here rather than in the worker entry point for the reason
 * `catalog-dispatch` gives: what a thread does is worth testing, and starting a thread to test
 * it is not. The entry point is then nothing but opening the database.
 */
export function serveCatalog(catalog: Catalog, port: CatalogServerPort): void {
  const queue = createCatalogQueue({
    run: request => dispatchCatalogRequest(catalog, request),
    answer: response => port.postMessage(response),
    // `setImmediate` rather than a microtask: a promise would resolve before the loop ever polls
    // the port, so an abandon posted while a query ran would arrive too late to save the next.
    yieldTo: setImmediate,
  })

  port.on('message', message => queue.accept(message))
}
