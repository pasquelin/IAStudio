import { join } from 'node:path'
import { chunk } from '@shared/collections'
import { messageOf } from '@shared/guards'
import type { Embedder } from '@main/memory/embedder'
import { actionCorpus } from './actionCorpus'
import type { ActionEmbedding, ActionHit } from './actionIndex'
import type { AsyncActionIndex } from './actionIndexClient'
import { openActionIndexThread } from './actionIndexThread'

const EMBED_BATCH = 32

export type ActionSearchService = {
  search: (query: string, limit?: number) => Promise<readonly ActionHit[]>
  close: () => Promise<void>
}

export type ActionSearchServiceDeps = {
  userData: string
  embedder: Embedder
  open?: (database: string) => Promise<AsyncActionIndex>
  onTrouble: (message: string) => void
}

export function createActionSearchService({
  userData,
  embedder,
  open = openActionIndexThread,
  onTrouble,
}: ActionSearchServiceDeps): ActionSearchService {
  let opening: Promise<AsyncActionIndex> | null = null
  let indexing: Promise<void> | null = null
  const holder = async (): Promise<AsyncActionIndex> => {
    if (opening) return await opening
    const started = open(join(userData, 'actions.db'))
    opening = started
    try {
      return await started
    } catch (error) {
      if (opening === started) opening = null
      throw error
    }
  }

  const catchUp = async (index: AsyncActionIndex, model: string): Promise<void> => {
    if ((await index.embeddingModel()) === model) return
    const corpus = actionCorpus()
    const embeddings: ActionEmbedding[] = []
    for (const batch of chunk([...corpus.actions], EMBED_BATCH)) {
      if (embedder.chosen() !== model) return
      const vectors = await embedder.embed(batch.map(action => action.searchable))
      if (vectors.length !== batch.length || embedder.chosen() !== model) return
      embeddings.push(
        ...batch.map((action, at) => ({
          name: action.name,
          model,
          values: vectors[at] ?? new Float32Array(),
        })),
      )
    }
    if (embedder.chosen() !== model) return
    await index.writeEmbeddings(embeddings)
  }

  return {
    search: async (query, limit) => {
      let index: AsyncActionIndex
      try {
        index = await holder()
      } catch (error) {
        onTrouble(messageOf(error))
        return []
      }
      const model = embedder.chosen()
      if (model !== null) {
        try {
          indexing ??= catchUp(index, model)
          await indexing
          const values = await embedder.embedQuery(query)
          if (values.length > 0 && embedder.chosen() === model)
            return await index.search({ query, limit, embedding: { model, values } })
        } catch (error) {
          onTrouble(messageOf(error))
        } finally {
          indexing = null
        }
      }
      return await index.search({ query, limit })
    },
    close: async () => {
      try {
        await indexing
      } catch {
        // Search already reported this failure; shutdown only waits for the write to settle.
      }
      if (!opening) return
      try {
        await (await opening).close()
      } catch (error) {
        onTrouble(messageOf(error))
      }
    },
  }
}
