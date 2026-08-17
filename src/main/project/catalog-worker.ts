import { parentPort, workerData } from 'node:worker_threads'
import { createCatalog } from './catalog'
import { serveCatalog } from './catalog-queue'
import { openProjectDisk } from './project-disk'
import { openNativeDatabase } from './sqlite-native'

/**
 * The catalogue's thread. Everything here is plumbing — the catalogue, the dispatch and the
 * queue are tested on their own, and this file only owns the database and the port.
 */

const port = parentPort
if (!port) throw new Error('catalog worker started without a parent port')

const file = typeof workerData === 'string' ? workerData : ''
if (!file) throw new Error('catalog worker started without a database file')

try {
  serveCatalog(createCatalog(openNativeDatabase(file)), port, openProjectDisk)

  // Only once the database is open and the migrations have run: the main process waits on this
  // before handing the catalogue out, so a corrupt file fails the open rather than the first query.
  port.postMessage({ ready: true })
} catch (error) {
  port.postMessage({ ready: false, error: error instanceof Error ? error.message : String(error) })
}
