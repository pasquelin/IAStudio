import { primaryRoleOf, type AiRoleId } from '@shared/domain/aiRole'
import type { ModelFamily } from '@shared/domain/model'
import { useModels } from './models'

/**
 * The model each employment is on, for a test that needs one — or none at all, called with
 * nothing. It replaces the per-family preference this repository carried until ADR-23.
 */
export function chooseModels(selected: Partial<Record<AiRoleId, string>> = {}): void {
  useModels.setState({ selected, preset: {}, prepared: null })
}

/**
 * The same, named by family, for the tests that read through a surface which still names one —
 * the rail, the generator, the canvas edits. Its FIRST employment is what those resolve to.
 */
export function chooseModelsByFamily(byFamily: Partial<Record<ModelFamily, string>>): void {
  const selected: Partial<Record<AiRoleId, string>> = {}
  for (const [family, modelId] of Object.entries(byFamily)) {
    const role = primaryRoleOf(family as ModelFamily)
    if (role && modelId) selected[role] = modelId
  }

  chooseModels(selected)
}
