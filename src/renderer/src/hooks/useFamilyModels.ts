import { useEffect, useState } from 'react'
import type { ModelFamily, ModelSummary } from '@shared/domain/model'
import { getBridge } from '@/services/bridge'

/**
 * A `<select>` is not a browser: past a hundred entries it stops being usable long before it
 * stops being complete. The picker deliberately shows only the head of the catalogue — the
 * order is the API's own relevance score, so the most used models are the ones it holds.
 */
const PICKER_LIMIT = 100

/**
 * The models of one family, fetched here rather than through a store: this list is read by
 * one screen, it is already cached by the registry in the main process, and the settings
 * window has no reason to hold a second replica of the catalogue.
 */
export function useFamilyModels(family: ModelFamily): ModelSummary[] {
  const [models, setModels] = useState<ModelSummary[]>([])

  useEffect(() => {
    let live = true
    const bridge = getBridge()

    void bridge?.scenario
      .searchModels({ family, limit: PICKER_LIMIT })
      .then(page => {
        if (live) setModels(page.items)
      })
      .catch(() => {
        // Not authenticated, or offline: an empty picker says so on its own.
        if (live) setModels([])
      })

    return () => {
      live = false
    }
  }, [family])

  return models
}
