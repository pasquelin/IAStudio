import { type ModelFamily, type ModelSummary } from '@shared/domain/model'
import { useLocalModels } from './useLocalModels'
import { useModelPages } from './useModelPages'

/**
 * The models of one family, local and cloud. Read through the registry rather than a store: it
 * already caches the catalogue in the main process, and no window needs a second replica.
 *
 * `null` is « do not ask », not « ask for everything »: a surface that will draw nothing must not
 * send a listing per selection — measured on screen, the inspector did exactly that.
 */
export function useFamilyModels(family: ModelFamily | null): readonly ModelSummary[] {
  const narrowed = family ? { family } : {}
  const onThisMachine = useLocalModels(['models', 'family', family], narrowed, family !== null)

  // Eight, for the hundred the single wide ask used to bring: what reads this derives the list of
  // services from it, so a model past the ceiling is a service that vanishes.
  const pages = useModelPages(['models', 'family', family], narrowed, family !== null, 8)

  // 🛑 `exhausted`, not `pending`: what reads this picks the FIRST service off the list and reads
  // its schema, so a list still growing changed that pick under the user — and the « mesh too
  // large » sentence appeared, then vanished. The manifests stand in until the walk is over.
  return pages.exhausted ? pages.items : onThisMachine
}
