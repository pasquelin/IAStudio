import type { MemoryIndexing } from '@shared/domain/assistantMemory'
import { messageOf } from '@shared/guards'
import type { AsyncMemory } from './memoryClient'
import type { Embedder } from './embedder'
import type { MemoryVector } from './vectors'

/**
 * Every memory brought up to date with the chosen model, one batch at a time.
 *
 * It does none of the work: the words come off a thread, the floats out of a process, and this
 * only decides how many at a time and when to stop — invariant 6.
 */

/** Where it has got to. The same shape a window reads, minus the scope only the host knows. */
export type EmbedProgress = Omit<MemoryIndexing, 'scope'>

/** Narrowed rather than the whole store: an indexing run reads no memory and writes none. */
export type VectorHolder = Pick<
  AsyncMemory,
  'pendingVectors' | 'withoutVector' | 'writeVectors' | 'dropOtherVectors'
>

/** A batch is answered in one go, so a question waits for all of it — `[M]` 9,7 ms each. */
const EMBED_BATCH = 8

export type EmbedQueue = {
  /**
   * Embeds what is missing, until nothing is or the signal is raised. Never two at once: a second
   * call JOINS the run going, rather than handing the same memories to the same process twice.
   */
  run: (holder: VectorHolder, signal?: AbortSignal) => Promise<number>
  /** How many memories this model has yet to see. What a panel shows without starting anything. */
  pending: (holder: VectorHolder) => Promise<number>
  /** Whether a run is in flight — what says whose signal a stop must raise. */
  busy: () => boolean
}

export type EmbedQueueDeps = {
  embedder: Embedder
  onProgress: (progress: EmbedProgress) => void
  /** Said when a batch fails. The run stops; what it wrote is kept. */
  onTrouble: (message: string) => void
  batch?: number
}

export function createEmbedQueue({
  embedder,
  onProgress,
  onTrouble,
  batch = EMBED_BATCH,
}: EmbedQueueDeps): EmbedQueue {
  let running: Promise<number> | null = null
  /**
   * 🛑 What the last sweep already cleaned up after, and which HOLDER it cleaned. `dropOtherVectors`
   * is a `model <> ?` the `(model, text_digest)` index cannot serve, so it is a full scan — and
   * `catchUp` fires on every remembered action, not only when the chosen model moved. The holder
   * is part of the key because a queue outlives the project it first ran for.
   */
  let swept: { model: string; holder: VectorHolder } | null = null

  const sweep = async (holder: VectorHolder, signal?: AbortSignal): Promise<number> => {
    const model = embedder.chosen()
    // No model chosen is not a failure: the retrieval works on exact search alone, and says so.
    if (model === null) return 0

    // Whatever another model left behind, before anything is counted: they are dead weight in
    // the index and would be scored against a question they cannot answer.
    if (swept?.model !== model || swept.holder !== holder) {
      await holder.dropOtherVectors(model)
      swept = { model, holder }
    }

    // 🛑 A CEILING that follows: the loop asks `withoutVector` again each round, so a memory
    // remembered mid-run is picked up by this run — and `done` passed the total sampled here,
    // which the window turned into a negative count and a bar that vanished mid-run.
    let total = await holder.pendingVectors(model)
    let done = 0
    onProgress({ done, total })

    while (!signal?.aborted) {
      const waiting = await holder.withoutVector(model, batch)
      if (waiting.length === 0) break

      // The signal travels ON: without it a stop only lands between batches, and the whole
      // cancel path — `processClient`'s abort, the worker's `dropped` — is unreachable.
      const values = await embedder.embed(
        waiting.map(one => one.text),
        signal,
      )
      // Fewer vectors than texts is a model that stopped answering: writing the first few against
      // the wrong memories would be worse than writing none, since nothing would ever say so.
      if (values.length !== waiting.length) {
        onTrouble('the embedder answered a different number of vectors than it was given')
        break
      }

      const vectors: MemoryVector[] = waiting.map((one, at) => ({
        memoryId: one.id,
        model,
        digest: one.digest,
        values: values[at] ?? new Float32Array(),
      }))

      await holder.writeVectors(vectors)
      done += vectors.length
      total = Math.max(total, done)
      onProgress({ done, total })
    }

    return done
  }

  return {
    run: async (holder, signal) => {
      // Joined rather than started: two runs would read the same page of pending memories and
      // hand both of them to the one process.
      if (running) return await running

      running = (async () => {
        try {
          return await sweep(holder, signal)
        } catch (error) {
          onTrouble(messageOf(error))
          return 0
        } finally {
          running = null
        }
      })()

      return await running
    },

    busy: () => running !== null,

    pending: async holder => {
      const model = embedder.chosen()
      return model === null ? 0 : await holder.pendingVectors(model)
    },
  }
}
