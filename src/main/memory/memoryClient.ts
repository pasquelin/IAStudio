import type { ProcessPort } from '@main/processClient'
import type { MemoryOp, MemoryRequest, MemoryResponse, MemoryResults } from './memoryProtocol'
import type { MemoryStore } from './memoryStore'

/** Injected rather than imported so the protocol can be tested without spawning a thread. */
export type MemoryPort = ProcessPort<MemoryRequest, MemoryResponse> & {
  terminate: () => Promise<void>
}

export const MEMORY_CLOSED = 'the memory is closed'

/** The store as the main process sees it: every operation of `MemoryStore`, each a promise. */
export type AsyncMemory = {
  [Op in keyof MemoryStore]: (
    ...args: Parameters<MemoryStore[Op]>
  ) => Promise<Awaited<ReturnType<MemoryStore[Op]>>>
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
    count: () => ask<'count'>({ op: 'count' }),
    markUsed: ids => ask<'markUsed'>({ op: 'markUsed', ids }),
    recall: wanted => ask<'recall'>({ op: 'recall', ask: wanted }),
    writeVectors: vectors => ask<'writeVectors'>({ op: 'writeVectors', vectors }),
    withoutVector: (model, limit) => ask<'withoutVector'>({ op: 'withoutVector', model, limit }),
    pendingVectors: model => ask<'pendingVectors'>({ op: 'pendingVectors', model }),
    dropOtherVectors: model => ask<'dropOtherVectors'>({ op: 'dropOtherVectors', model }),
    rebuild: () => ask<'rebuild'>({ op: 'rebuild' }),
    refresh: () => ask<'refresh'>({ op: 'refresh' }),
    compact: () => ask<'compact'>({ op: 'compact' }),
    reset: () => ask<'reset'>({ op: 'reset' }),
    trouble: () => ask<'trouble'>({ op: 'trouble' }),

    /**
     * 🛑 The thread is TOLD before it is terminated, and the answer is waited for: what it still
     * has queued is an append to the file the next launch reads back, and `terminate` is a kill.
     * Rejecting the callers and killing it — which is what this did — lost those writes silently.
     */
    close: async () => {
      try {
        if (!shut) await ask<'close'>({ op: 'close' })
      } catch {
        // A thread that will not settle must not stop the studio from quitting; it is killed
        // below either way, and what it failed to write is what a rebuild reads back.
      }

      shut ??= new Error(MEMORY_CLOSED)
      for (const held of waiting.values()) held.reject(shut)
      waiting.clear()
      await port.terminate()
    },
  }
}
