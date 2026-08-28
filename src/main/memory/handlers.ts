import type { MemoryScope } from '@shared/domain/assistantMemory'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { broadcast } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'
import type { AsyncMemory } from './memoryClient'
import type { MemoryHost } from './memoryHost'
import type { MemoryVectors } from './memoryVectors'
import {
  parseMemoryDraft,
  parseMemoryPatch,
  parseMemoryQuery,
  parseMemoryRecallAsk,
  parseMemoryScope,
} from './validation'

export type MemoryHandlerDeps = {
  host: MemoryHost
  vectors: MemoryVectors
}

/**
 * The two memories, across the boundary.
 *
 * Everything a window sends is checked here and nowhere else: the channel is typed, but
 * TypeScript is gone at runtime and the sender is a renderer.
 */
export function registerMemoryHandlers({ host, vectors }: MemoryHandlerDeps): void {
  const memoryOf = async (scope: unknown): Promise<[MemoryScope, AsyncMemory | null]> => {
    const wanted = parseMemoryScope(scope)
    return [wanted, await host.of(wanted)]
  }

  handle(CHANNELS.memoryList, async (_event, scope, query) => {
    const [, memory] = await memoryOf(scope)
    // No project open is a studio on its home screen, not a failure: an empty list is the answer.
    return (await memory?.list(parseMemoryQuery(query))) ?? []
  })

  /**
   * 🛑 Through `vectors` and not the memory: this is where the question is EMBEDDED, and a recall
   * that went straight to the store would rank on words alone while pretending otherwise.
   */
  handle(CHANNELS.memoryRecall, async (_event, scope, ask) => {
    return await vectors.recall(parseMemoryScope(scope), parseMemoryRecallAsk(ask))
  })

  handle(CHANNELS.memoryRead, async (_event, scope, id) => {
    const [, memory] = await memoryOf(scope)
    return (await memory?.read(String(id))) ?? null
  })

  handle(CHANNELS.memoryRemember, async (_event, scope, draft) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return null

    const written = await memory.remember(parseMemoryDraft(draft))
    broadcast(EVENTS.memoryChanged, wanted)
    // Not awaited: a window that waited on 24 ms of embedding per memory is a window that stopped
    // drawing to compute something nothing on screen reads.
    vectors.catchUp(wanted)
    return written
  })

  handle(CHANNELS.memoryAmend, async (_event, scope, id, patch) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return null

    const amended = await memory.amend(String(id), parseMemoryPatch(patch))
    if (amended) {
      broadcast(EVENTS.memoryChanged, wanted)
      // Reworded is re-embedded: the digest that ties a vector to its words no longer matches.
      vectors.catchUp(wanted)
    }
    return amended
  })

  handle(CHANNELS.memoryForget, async (_event, scope, id) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return false

    const forgotten = await memory.forget(String(id))
    if (forgotten) broadcast(EVENTS.memoryChanged, wanted)
    return forgotten
  })

  handle(CHANNELS.memoryRebuild, async (_event, scope) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return 0

    const read = await memory.rebuild()
    broadcast(EVENTS.memoryChanged, wanted)
    vectors.catchUp(wanted)
    return read
  })

  /**
   * 🛑 The scope alone, never `memoryOf`, which OPENS the memory: a studio with no embedding
   * model answers these three without a thread, and `memoryOf` would disarm that guard here.
   */
  handle(CHANNELS.memoryPending, async (_event, scope) => {
    return await vectors.pending(parseMemoryScope(scope))
  })

  handle(CHANNELS.memoryIndex, async (_event, scope) => {
    vectors.catchUp(parseMemoryScope(scope))
  })

  handle(CHANNELS.memoryStopIndex, async (_event, scope) => {
    vectors.stop(parseMemoryScope(scope))
  })

  handle(CHANNELS.memoryCompact, async (_event, scope) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return 0

    const saved = await memory.compact()
    if (saved > 0) broadcast(EVENTS.memoryChanged, wanted)
    return saved
  })

  handle(CHANNELS.memoryReset, async (_event, scope) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return

    await memory.reset()
    broadcast(EVENTS.memoryChanged, wanted)
  })
}
