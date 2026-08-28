import type { MemoryScope } from '@shared/domain/assistantMemory'
import { CHANNELS, EVENTS } from '@shared/ipc'
import { broadcast } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'
import type { AsyncMemory } from './memoryClient'
import type { MemoryHost } from './memoryHost'
import {
  parseMemoryDraft,
  parseMemoryPatch,
  parseMemoryQuery,
  parseMemoryScope,
} from './validation'

export type MemoryHandlerDeps = {
  host: MemoryHost
}

/**
 * The two memories, across the boundary.
 *
 * Everything a window sends is checked here and nowhere else: the channel is typed, but
 * TypeScript is gone at runtime and the sender is a renderer.
 */
export function registerMemoryHandlers({ host }: MemoryHandlerDeps): void {
  const memoryOf = async (scope: unknown): Promise<[MemoryScope, AsyncMemory | null]> => {
    const wanted = parseMemoryScope(scope)
    return [wanted, wanted === 'global' ? await host.global() : await host.project()]
  }

  handle(CHANNELS.memoryList, async (_event, scope, query) => {
    const [, memory] = await memoryOf(scope)
    // No project open is a studio on its home screen, not a failure: an empty list is the answer.
    return (await memory?.list(parseMemoryQuery(query))) ?? []
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
    return written
  })

  handle(CHANNELS.memoryAmend, async (_event, scope, id, patch) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return null

    const amended = await memory.amend(String(id), parseMemoryPatch(patch))
    if (amended) broadcast(EVENTS.memoryChanged, wanted)
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
    return read
  })

  handle(CHANNELS.memoryReset, async (_event, scope) => {
    const [wanted, memory] = await memoryOf(scope)
    if (!memory) return

    await memory.reset()
    broadcast(EVENTS.memoryChanged, wanted)
  })
}
