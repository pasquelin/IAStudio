import { createCatalog } from './catalog'
import { openMemoryDatabase } from './sqlite-memory'
import type { AsyncCatalog } from './catalog-client'

/**
 * A catalogue with the production shape but no thread: real SQLite, answered as promises.
 *
 * The thread is what `catalog-client` and `catalog-dispatch` cover. Everything upstream only
 * cares that the catalogue answers later, so paying for a worker per test would buy nothing.
 */
export function memoryCatalog(file = ':memory:'): AsyncCatalog {
  const catalog = createCatalog(openMemoryDatabase(file))

  return {
    add: async asset => catalog.add(asset),
    find: async assetId => catalog.find(assetId),
    findByRemoteId: async remoteAssetId => catalog.findByRemoteId(remoteAssetId),
    search: async query => catalog.search(query),
    close: async () => catalog.close(),
  }
}
