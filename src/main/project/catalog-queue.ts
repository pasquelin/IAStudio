import { messageOf } from '@shared/guards'
import type { Catalog } from './catalog'
import { dispatchCatalogRequest } from './catalog-dispatch'
import {
  ABANDONED,
  isAbandon,
  isQueueMessage,
  isRescan,
  isRescanStop,
  type CatalogMessage,
  type CatalogQueueMessage,
  type CatalogRequest,
  type CatalogRescan,
  type CatalogRescanProgress,
  type CatalogResponse,
} from './catalog-protocol'
import { rescanProject, type RescanDisk, type RescanReport } from './catalog-rescan'
import { itemsBackupOf, writeItemsBackup } from './items-backup'

export type CatalogQueue = {
  /** Takes one message. A request is queued; an abandon marks one that has not run yet. */
  accept: (message: CatalogQueueMessage) => void
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
  postMessage: (response: CatalogResponse | CatalogRescanProgress) => void
  on: (event: 'message', listener: (message: CatalogMessage) => void) => void
}

/**
 * How the thread reaches the project folder. Handed in rather than imported, for the reason
 * everything else in this file is: what is worth testing is the routing, and a `node:fs` bound
 * into it would make that need a folder.
 */
export type CatalogDiskOpener = (root: string) => RescanDisk

/**
 * A catalogue answering on a port. Here rather than in the worker entry point for the reason
 * `catalog-dispatch` gives: what a thread does is worth testing, and starting a thread to test
 * it is not. The entry point is then nothing but opening the database.
 *
 * A rescan runs BESIDE the queue rather than in it: it is asynchronous and long where every
 * request is synchronous and short, and putting it in the queue would hold every search behind
 * a folder walk. Both give the loop back between steps, so they interleave — which is what lets
 * a window keep searching while the project is being reconciled.
 */
export function serveCatalog(
  catalog: Catalog,
  port: CatalogServerPort,
  openDisk: CatalogDiskOpener | null = null,
): void {
  const queue = createCatalogQueue({
    run: request => dispatchCatalogRequest(catalog, request),
    answer: response => port.postMessage(response),
    // `setImmediate` rather than a microtask: a promise would resolve before the loop ever polls
    // the port, so an abandon posted while a query ran would arrive too late to save the next.
    yieldTo: setImmediate,
  })

  const stopping = new Set<number>()

  const rescan = (message: CatalogRescan): void => {
    if (!openDisk) {
      port.postMessage({ id: message.id, ok: false, error: 'this catalogue cannot reach a disk' })
      return
    }

    /**
     * The backup is written after a COMPLETE pass, and only there.
     *
     * It is the one moment the catalogue has just been held against the disk, so what it says is
     * as true as it will ever be — and it is in this thread, which holds both the rows and a
     * folder to write into, so the whole table never crosses a boundary to be saved.
     *
     * A pass that was called off writes nothing: what it read is a partial reading of the folder,
     * and a backup of that would be a backup of less than what exists.
     */
    const saveBackup = async (report: RescanReport): Promise<RescanReport> => {
      // Failure is not the pass's failure: reconciling worked, and a backup that could not be
      // written is a project with no backup rather than a project that was not reconciled.
      if (report.complete) {
        await writeItemsBackup(
          message.root,
          itemsBackupOf(catalog.backup(), new Date().toISOString()),
        ).catch(() => {})
      }
      return report
    }

    rescanProject(catalog, openDisk(message.root), {
      now: () => new Date().toISOString(),
      stopped: () => stopping.has(message.id),
      // `setImmediate` for the reason the queue uses it: a microtask resolves before the port is
      // ever polled, so a stop posted mid-pass would not be seen until the pass was over.
      yieldTo: () => new Promise<void>(resume => setImmediate(resume)),
      onProgress: ({ done, total }) => port.postMessage({ rescan: message.id, done, total }),
    })
      .then(saveBackup)
      .then(
        report => port.postMessage({ id: message.id, ok: true, rescan: report }),
        (error: unknown) =>
          port.postMessage({ id: message.id, ok: false, error: messageOf(error) }),
      )
      .finally(() => stopping.delete(message.id))
  }

  port.on('message', message => {
    if (isRescan(message)) rescan(message)
    else if (isRescanStop(message)) stopping.add(message.target)
    else if (isQueueMessage(message)) queue.accept(message)
  })
}
