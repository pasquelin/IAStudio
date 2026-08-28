import type { MemoryStore } from './memoryStore'
import type { MemoryRequest } from './memoryProtocol'

/**
 * One request, answered by the store. A pure switch, and it never throws on an unknown op: the
 * union is closed, so a new one fails to compile here rather than answering nothing at runtime.
 */
export async function dispatchMemoryRequest(
  store: MemoryStore,
  request: MemoryRequest,
): Promise<unknown> {
  switch (request.op) {
    case 'remember':
      return await store.remember(request.draft)
    case 'amend':
      return await store.amend(request.memoryId, request.patch)
    case 'forget':
      return await store.forget(request.memoryId)
    case 'read':
      return await store.read(request.memoryId)
    case 'list':
      return await store.list(request.query)
    case 'markUsed':
      return await store.markUsed(request.ids)
    case 'rebuild':
      return await store.rebuild()
    case 'refresh':
      return await store.refresh()
    case 'reset':
      return await store.reset()
    case 'trouble':
      return store.trouble()
    case 'close':
      return await store.close()
  }
}
