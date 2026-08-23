import type { AiRoleId } from '@shared/domain/aiRole'
import { useModels } from './models'

/**
 * The model each employment is on, for a test that needs one — or none at all, called with
 * nothing. It replaces the per-family preference this repository carried until ADR-23.
 */
export function chooseModels(selected: Partial<Record<AiRoleId, string>> = {}): void {
  useModels.setState({ selected, preset: {} })
}
