import type {
  Memory,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryTrouble,
} from '@shared/domain/assistantMemory'
import type { MemoryOp, MemoryRequest, MemoryResponse, MemoryResults } from './memoryProtocol'

/**
 * The thread, reduced to what the client needs. Injected rather than imported so the protocol
 * can be tested against a real store without spawning anything.
 */
export type MemoryPort = {
  postMessage: (message: MemoryRequest) => void
  onMessage: (listener: (response: MemoryResponse) => void) => void
  /** The thread died. Whatever it was asked will never be answered. */
  onFailure: (listener: (error: Error) => void) => void
  terminate: () => Promise<void>
}

export const MEMORY_CLOSED = 'the memory is closed'

/** The store as the main process sees it: the same operations, each a promise. */
export type AsyncMemory = {
  remember: (draft: MemoryDraft) => Promise<Memory>
  amend: (id: string, patch: MemoryPatch) => Promise<Memory | null>
  forget: (id: string) => Promise<boolean>
  read: (id: string) => Promise<Memory | null>
  list: (query: MemoryQuery) => Promise<readonly Memory[]>
  markUsed: (ids: readonly string[]) => Promise<void>
  /** Reads the file into the index. Answers how many memories stand once it has. */
  rebuild: () => Promise<number>
  reset: () => Promise<void>
  trouble: () => Promise<MemoryTrouble | null>
  close: () => Promise<void>
}

type Waiting = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export function createMemoryClient(port: MemoryPort): AsyncMemory {
  const waiting = new Map<number, Waiting>()
  let nextId = 0
  // The REASON rather than a flag: a caller arriving after the thread died deserves the cause,
  // not « the memory is closed » about a memory nobody closed.
  let shut: Error | null = null

  port.onMessage(response => {
    const held = waiting.get(response.id)
    if (!held) return

    waiting.delete(response.id)
    if (response.ok) held.resolve(response.value)
    else held.reject(new Error(response.error))
  })

  // A thread that dies leaves every caller waiting for ever otherwise — and a window waiting on
  // a memory is a window that never draws its panel.
  port.onFailure(error => {
    shut = error
    for (const held of waiting.values()) held.reject(error)
    waiting.clear()
  })

  const ask = <Op extends MemoryOp>(
    request: Omit<Extract<MemoryRequest, { op: Op }>, 'id'>,
  ): Promise<MemoryResults[Op]> =>
    new Promise<MemoryResults[Op]>((resolve, reject) => {
      if (shut) {
        reject(shut)
        return
      }

      const id = ++nextId
      // The two casts are the same one fact: the protocol pairs an `op` with its result type,
      // and TypeScript cannot narrow a value it only knows through a generic parameter.
      waiting.set(id, { resolve: value => resolve(value as MemoryResults[Op]), reject })
      port.postMessage({ ...request, id } as MemoryRequest)
    })

  return {
    remember: draft => ask<'remember'>({ op: 'remember', draft }),
    amend: (memoryId, patch) => ask<'amend'>({ op: 'amend', memoryId, patch }),
    forget: memoryId => ask<'forget'>({ op: 'forget', memoryId }),
    read: memoryId => ask<'read'>({ op: 'read', memoryId }),
    list: query => ask<'list'>({ op: 'list', query }),
    markUsed: ids => ask<'markUsed'>({ op: 'markUsed', ids }),
    rebuild: () => ask<'rebuild'>({ op: 'rebuild' }),
    reset: () => ask<'reset'>({ op: 'reset' }),
    trouble: () => ask<'trouble'>({ op: 'trouble' }),

    close: async () => {
      shut ??= new Error(MEMORY_CLOSED)
      for (const held of waiting.values()) held.reject(shut)
      waiting.clear()
      await port.terminate()
    },
  }
}
