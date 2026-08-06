import type Scenario from '@scenario-labs/sdk'
import type { ModelCatalog } from './model-registry'

/** Largest page the API accepts — the fewer round trips, the fewer chances of a 429. */
const PAGE_SIZE = 500

/**
 * `GET /models` answers with the caller's OWN trained models only, and nothing says so in the
 * signature. A fresh account has trained none, so the picker came back empty while the whole
 * catalogue sat behind `privacy: 'public'` — measured: 0 private, 642 public.
 *
 * Private first: a model the user trained themselves outranks the six hundred others.
 */
const PRIVACIES: readonly ('private' | 'public')[] = ['private', 'public']

/**
 * Binds the registry's narrow catalogue to the real SDK. The only file where the two meet, so
 * a change in the SDK's shape lands here rather than throughout the registry.
 */
export function catalogOf(client: Scenario): ModelCatalog {
  return {
    list: async function* () {
      for (const privacy of PRIVACIES) {
        yield* client.models.list({ pageSize: PAGE_SIZE, privacy })
      }
    },
    retrieve: modelId => client.models.retrieve(modelId),
  }
}
