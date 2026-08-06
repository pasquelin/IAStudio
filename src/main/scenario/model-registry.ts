import type { ModelDescriptor, ModelFamily, ModelSummary } from '@shared/domain/model'
import { familyOf, translateSchema, type ScenarioInput } from './schema'

/**
 * A model as the API returns it, reduced to what the studio reads. Narrower than the SDK
 * type on purpose: it is the whole contract with the outside world, and it is what lets the
 * registry be tested without a network.
 */
export type RemoteModel = {
  id: string
  name?: string
  capabilities?: readonly string[]
  source?: string
  shortDescription?: string
  thumbnail?: { url?: string }
  inputs?: readonly ScenarioInput[]
}

export type ModelCatalog = {
  list: () => AsyncIterable<RemoteModel>
  retrieve: (modelId: string) => Promise<{ model: RemoteModel }>
}

export type ModelRegistry = {
  list: (family?: ModelFamily) => Promise<ModelSummary[]>
  describe: (modelId: string) => Promise<ModelDescriptor>
  invalidate: () => void
}

export type RegistryOptions = {
  catalog: () => ModelCatalog
  ttlMs?: number
  now?: () => number
}

const DEFAULT_TTL_MS = 10 * 60 * 1000

function summaryOf(model: RemoteModel): ModelSummary {
  const summary: ModelSummary = {
    id: model.id,
    // An unnamed model is still usable; showing its id beats showing nothing.
    name: model.name ?? model.id,
    family: familyOf(model.capabilities),
    source: model.source ?? 'other',
  }

  if (model.shortDescription) summary.description = model.shortDescription
  if (model.thumbnail?.url) summary.thumbnail = model.thumbnail.url

  return summary
}

type Cached<T> = { at: number; value: T }

/**
 * Caches the model catalogue. Listing walks every page, and the schema of a model changes at
 * Scenario's pace, not at ours: refetching on each keystroke of a picker would spend the rate
 * budget on data that is stable for hours.
 */
export function createModelRegistry({
  catalog,
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now,
}: RegistryOptions): ModelRegistry {
  let summaries: Cached<ModelSummary[]> | null = null
  const descriptors = new Map<string, Cached<ModelDescriptor>>()

  const fresh = <T>(entry: Cached<T> | null | undefined): T | null =>
    entry && now() - entry.at < ttlMs ? entry.value : null

  const allSummaries = async (): Promise<ModelSummary[]> => {
    const cached = fresh(summaries)
    if (cached) return cached

    const collected: ModelSummary[] = []
    // Auto-pagination: the SDK walks the cursor, so the page size never leaks into our code.
    for await (const model of catalog().list()) collected.push(summaryOf(model))

    summaries = { at: now(), value: collected }
    return collected
  }

  return {
    list: async family => {
      const all = await allSummaries()
      return family ? all.filter(summary => summary.family === family) : all
    },

    describe: async modelId => {
      const cached = fresh(descriptors.get(modelId))
      if (cached) return cached

      const { model } = await catalog().retrieve(modelId)
      const descriptor: ModelDescriptor = {
        ...summaryOf(model),
        fields: translateSchema(model.inputs),
      }

      descriptors.set(modelId, { at: now(), value: descriptor })
      return descriptor
    },

    invalidate: () => {
      summaries = null
      descriptors.clear()
    },
  }
}
