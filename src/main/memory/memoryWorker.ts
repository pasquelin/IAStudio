import { randomUUID } from 'node:crypto'
import { parentPort, workerData } from 'node:worker_threads'
import { openNativeDatabase } from '@main/project/sqliteNative'
import { createMemoryIndex } from './memoryIndex'
import { dispatchMemoryRequest } from './memoryDispatch'
import type { MemoryRequest } from './memoryProtocol'
import { createMemoryStore } from './memoryStore'

/**
 * The memory's thread. Everything here is plumbing — the store, the index and the dispatch are
 * tested on their own, and this file only owns the database, the port and the first read.
 */

type Started = { file: string; database: string }

const isStarted = (value: unknown): value is Started =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Started).file === 'string' &&
  typeof (value as Started).database === 'string'

const port = parentPort
if (!port) throw new Error('memory worker started without a parent port')

if (!isStarted(workerData)) throw new Error('memory worker started without its two files')

try {
  const store = createMemoryStore({
    file: workerData.file,
    index: createMemoryIndex(openNativeDatabase(workerData.database)),
    now: () => new Date().toISOString(),
    newId: () => `m_${randomUUID()}`,
  })

  port.on('message', (request: MemoryRequest) => {
    void answer(store, request)
  })

  // The file is read before anything is answered: the main process waits on this, so an index
  // built from an older file never answers a single query.
  void start(store)
} catch (error) {
  port.postMessage({ ready: false, error: error instanceof Error ? error.message : String(error) })
}

type Served = Parameters<typeof dispatchMemoryRequest>[0]

/** Named rather than a `.then` chain: what it does is answer one request, whatever happens. */
async function answer(store: Served, request: MemoryRequest): Promise<void> {
  try {
    port?.postMessage({
      id: request.id,
      ok: true,
      value: await dispatchMemoryRequest(store, request),
    })
  } catch (error) {
    port?.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function start(store: Served): Promise<void> {
  try {
    await store.rebuild()
    port?.postMessage({ ready: true })
  } catch (error) {
    port?.postMessage({
      ready: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
