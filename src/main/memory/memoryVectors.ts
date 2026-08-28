import type { Memory, MemoryRef, MemoryScope } from '@shared/domain/assistantMemory'
import { messageOf } from '@shared/guards'
import type { Embedder } from './embedder'
import { createEmbedQueue, type EmbedProgress, type EmbedQueue } from './embedQueue'
import { recalledWithin } from './recallScore'
import type { MemoryHost } from './memoryHost'

/**
 * The vectors of the two memories: one queue each, one embedder for both.
 *
 * A queue per scope because a queue JOINS the run already going — a single one would answer a
 * call about the machine's memory with a count belonging to the project's.
 */
export type MemoryVectors = {
  /**
   * Brings a scope up to date, in the background. Answers nothing: a caller waiting on this waits
   * `[M]` 9,7 ms a memory for something nothing on screen reads. What is missing is `pending`.
   */
  catchUp: (scope: MemoryScope) => void
  pending: (scope: MemoryScope) => Promise<number>
  /** Stops the run in flight; what it wrote is kept. Half an index is not a broken one. */
  stop: (scope: MemoryScope) => void
  /**
   * What the assistant should be reminded of, as summaries — one per line, best first.
   *
   * Empty for a studio with no project open, and for one that has learned nothing. Never a
   * refusal: a turn happens with or without a memory, and waiting on one would cost the turn.
   */
  recalled: (utterance: string, refs: readonly MemoryRef[], room: number) => Promise<string>
  close: () => Promise<void>
}

export type MemoryVectorsDeps = {
  host: MemoryHost
  embedder: Embedder
  onProgress: (scope: MemoryScope, progress: EmbedProgress) => void
  onTrouble: (message: string) => void
}

/** How many the thread ranks before the budget cuts. Ranking costs nothing; reading them does. */
const RECALL_LIMIT = 20

/**
 * The summary alone — no id, which would cost 38 characters a line of a budget already negative.
 * A model that wants the body asks `memory.recall`, which answers ids.
 */
const summaryLine = (one: Memory): string => `  ${one.summary}`

export function createMemoryVectors({
  host,
  embedder,
  onProgress,
  onTrouble,
}: MemoryVectorsDeps): MemoryVectors {
  const queues = new Map<MemoryScope, EmbedQueue>()
  // One per scope, replaced at each run: an abort raised on the last run must not stop the next
  // one before it has read a single memory.
  const stops = new Map<MemoryScope, AbortController>()

  const queueFor = (scope: MemoryScope): EmbedQueue => {
    const held = queues.get(scope)
    if (held) return held

    const made = createEmbedQueue({
      embedder,
      onProgress: progress => onProgress(scope, progress),
      onTrouble,
    })
    queues.set(scope, made)
    return made
  }

  return {
    catchUp: scope => {
      void indexed(scope)
    },

    pending: async scope => {
      // 🛑 Before the holder, and that ordering is the performance rule: opening a memory opens a
      // thread and a database, and a studio with no embedding model has nothing to count.
      if (embedder.chosen() === null) return 0

      const holder = await host.of(scope)
      return holder === null ? 0 : await queueFor(scope).pending(holder)
    },

    stop: scope => stops.get(scope)?.abort(),

    recalled: async (utterance, refs, room) => {
      try {
        return await remembered(utterance, refs, room)
      } catch (error) {
        // 🛑 Swallowed on purpose, and it is the whole contract: `brainRouted` awaits this inside
        // the same `Promise.all` as the provider, so a dead embedder would kill the TURN.
        onTrouble(messageOf(error))
        return ''
      }
    },

    close: async () => {
      for (const one of stops.values()) one.abort()
      await embedder.close()
    },
  }

  async function remembered(
    utterance: string,
    refs: readonly MemoryRef[],
    room: number,
  ): Promise<string> {
    if (room <= 0) return ''

    const memory = await host.of('project')
    if (memory === null) return ''

    const model = embedder.chosen()
    // 🛑 Embedded ONLY where a model can answer: a studio without one pays nothing for the
    // attempt, and falls back on exact search rather than pretending to have searched.
    const question = model === null ? undefined : await embedder.embedQuery(utterance)

    const found = await memory.recall({
      text: utterance,
      refs,
      ...(question && question.length > 0 && model ? { question, model } : {}),
      now: new Date().toISOString(),
      limit: RECALL_LIMIT,
    })

    const kept = recalledWithin(
      found.map(one => ({ memory: one, score: 0 })),
      room,
    )
    // Stamped as served, which is what later makes an unused memory age.
    if (kept.length > 0) void memory.markUsed(kept.map(one => one.id))

    return kept.map(summaryLine).join('\n')
  }

  /** Named rather than a floating chain: what it does is index one scope, whatever happens. */
  async function indexed(scope: MemoryScope): Promise<void> {
    try {
      // Asked before anything is opened — see `pending`.
      if (embedder.chosen() === null) return

      const holder = await host.of(scope)
      if (holder === null) return

      const queue = queueFor(scope)
      // 🛑 Replaced only when no run is going. `run` JOINS one already in flight and ignores the
      // new signal, so overwriting here left Stop aborting a controller nothing was watching.
      const stop = queue.busy()
        ? (stops.get(scope) ?? new AbortController())
        : new AbortController()
      stops.set(scope, stop)
      await queue.run(holder, stop.signal)
    } catch (error) {
      onTrouble(messageOf(error))
    }
  }
}
