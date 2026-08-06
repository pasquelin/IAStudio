import type Scenario from '@scenario-labs/sdk'
import type { ModelCatalog } from './model-registry'

/** Largest page the API accepts — the fewer round trips, the fewer chances of a 429. */
const PAGE_SIZE = 500

/**
 * Binds the registry's narrow catalogue to the real SDK. The only file where the two meet, so
 * a change in the SDK's shape lands here rather than throughout the registry.
 */
export function catalogOf(client: Scenario): ModelCatalog {
  return {
    list: () => client.models.list({ pageSize: PAGE_SIZE }),
    retrieve: modelId => client.models.retrieve(modelId),
  }
}
