import { primaryRoleOf, type AiRoleId, type RoleProvider } from '@shared/domain/aiRole'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { MODEL_FAMILIES } from '@shared/domain/model'
import { shippedModel } from '@main/ai/catalogue'

/**
 * What `generation.defaultModels` becomes now that a preference is filed per employment —
 * ADR-23 § A. Read once, from a settings file written before it; never written again.
 *
 * The family's FIRST employment, which is the only one that preference ever reached:
 * `resolveModelForFamily` looked up `primaryRoleOf(family)` and nothing else.
 *
 * 🛑 A cloud model loses its NAME, and it cannot be otherwise: a cloud `RoleProvider` says which
 * account pays, never which model runs — that one lives in the panel's own pick. The employment
 * therefore comes back served by Scenario, with the model to choose again. A local model
 * survives whole, its id being what the provider carries.
 */
export function migratedRoleChoices(
  defaultModels: Readonly<Record<string, string>>,
  existing: Readonly<Partial<Record<AiRoleId, RoleProvider>>>,
): Partial<Record<AiRoleId, RoleProvider>> {
  const migrated: Partial<Record<AiRoleId, RoleProvider>> = {}

  for (const family of MODEL_FAMILIES) {
    const modelId = defaultModels[family]
    const role = primaryRoleOf(family)
    // Never over a choice already made on the employment side: that one was made against this
    // very screen's successor, so it is the newer of the two.
    if (!modelId || !role || existing[role]) continue

    migrated[role] = shippedModel(modelId)
      ? { kind: 'local', modelId }
      : { kind: 'cloud', providerId: SCENARIO_CLOUD }
  }

  return { ...migrated, ...existing }
}
