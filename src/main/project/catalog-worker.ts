import { parentPort, workerData } from 'node:worker_threads'
import { createCatalog } from './catalog'
import { dispatchCatalogRequest } from './catalog-dispatch'
import { createCatalogQueue } from './catalog-queue'
import { openNativeDatabase } from './sqlite-native'
import type { CatalogMessage } from './catalog-protocol'

/**
 * The catalogue's thread. Everything here is plumbing — the catalogue and the dispatch are
 * tested on their own, and this file only owns the database and the message loop.
 */

const port = parentPort
if (!port) throw new Error('catalog worker started without a parent port')

const file = typeof workerData === 'string' ? workerData : ''
if (!file) throw new Error('catalog worker started without a database file')

try {
  const catalog = createCatalog(openNativeDatabase(file))

  const queue = createCatalogQueue({
    run: request => dispatchCatalogRequest(catalog, request),
    answer: response => port.postMessage(response),
    // `setImmediate` rather than a microtask: a promise would resolve before the loop ever polls
    // the port, so an abandon posted while a query ran would arrive too late to save the next.
    yieldTo: setImmediate,
  })

  port.on('message', (message: CatalogMessage) => queue.accept(message))

  // Only once the database is open and the migrations have run: the main process waits on this
  // before handing the catalogue out, so a corrupt file fails the open rather than the first query.
  port.postMessage({ ready: true })
} catch (error) {
  port.postMessage({ ready: false, error: error instanceof Error ? error.message : String(error) })
}
