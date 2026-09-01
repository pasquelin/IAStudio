import { writeQueue } from '@main/persistence'
import { createProcessClient, type ProcessPort } from '@main/processClient'
import type { EmbedAsk, EmbedRequest, EmbedResponse } from './embedProtocol'

export type EmbedPort = ProcessPort<EmbedRequest, EmbedResponse> & { kill: () => void }

export const EMBEDDER_GONE = 'the embedding process is gone'

export type EmbedClient = {
  /** Loads the weights and answers how many dimensions they produce. Rejects where it cannot. */
  load: (
    weights: string,
    documentPrefix: string,
    queryPrefix: string,
    contextTokens: number,
  ) => Promise<number>
  /** A batch of documents, in the order they were given. */
  embed: (texts: readonly string[], signal?: AbortSignal) => Promise<readonly Float32Array[]>
  /** One question. The other prefix, and the only difference — see `EmbedLoad`. */
  embedQuery: (text: string) => Promise<Float32Array>
  close: () => void
}

export function createEmbedClient(port: EmbedPort): EmbedClient {
  const runs = createProcessClient<EmbedRequest, EmbedResponse, unknown>({
    port,
    runOf: response => response.id,
    read: response =>
      response.ok
        ? { kind: 'settled', result: response.value }
        : { kind: 'failed', error: response.error },
    gone: EMBEDDER_GONE,
    cancel: id => ({ id, cancel: true }),
  })

  // 🛑 One at a time: the process holds ONE context, and two batches inside it at once would
  // share a sequence built for one. What keeps a question from waiting behind a long batch is
  // the SIZE of a batch, not this — see `EMBED_BATCH`.
  const queue = writeQueue()

  const ask = (request: EmbedAsk, signal?: AbortSignal): Promise<unknown> =>
    queue.next(
      async () => await runs.send(id => ({ ...request, id }), { ...(signal && { signal }) }),
    )

  return {
    /**
     * CHECKED rather than cast: a process answering something else did not load, and vectors
     * written against a length nobody verified are unusable floats nothing would report.
     */
    load: async (weights, documentPrefix, queryPrefix, contextTokens) => {
      const dims = await ask({ op: 'load', weights, documentPrefix, queryPrefix, contextTokens })
      if (typeof dims !== 'number' || dims <= 0) {
        throw new Error('the embedder answered no dimensions')
      }

      return dims
    },

    embed: async (texts, signal) =>
      vectorsOf(await ask({ op: 'embed', texts, asQuery: false }, signal)),

    embedQuery: async text => {
      const [vector] = vectorsOf(await ask({ op: 'embed', texts: [text], asQuery: true }))
      // A model that answered nothing for a question cannot answer it: an empty vector compares
      // as nothing alike, which is what a retrieval falls back from.
      return vector ?? new Float32Array()
    },

    // Killing it is what rejects the callers: the exit reaches `onFailure`, which is the one
    // path that empties the pending runs — see `processClient`.
    close: () => port.kill(),
  }
}

/** A batch of the wrong shape reads as « no vectors », never as empty ones written to the index. */
function vectorsOf(value: unknown): readonly Float32Array[] {
  return Array.isArray(value) ? value.filter(one => one instanceof Float32Array) : []
}
