import { DICTATION_ROLE, type AiRoleId } from '@shared/domain/aiRole'
import { STT_MODEL } from '@shared/domain/dictation'
import { modelRefusalOf, type LocalModel } from '@shared/domain/localModel'

/**
 * The models the application ships with — rank 1 of ADR-20, versioned with the binary.
 *
 * It holds ONE model, and that is a measurement rather than a gap: the recognition model is the
 * only one this studio can both install and run today. A catalogue listing what it cannot install
 * would show the person entries that lead nowhere, and a plausible catalogue costs more than a
 * short one.
 *
 * What it takes to grow: a model whose weights the studio fetches itself needs nothing but its
 * manifest; one a runtime pulls for itself — `ollama pull`, measured working on 2026-08-21 — needs
 * the adapter that asks, which does not exist yet.
 */
const SHIPPED: readonly { readonly role: AiRoleId; readonly model: LocalModel }[] = [
  { role: DICTATION_ROLE, model: STT_MODEL },
]

/** Every shipped model, whatever role it serves. */
export function shippedModels(): readonly LocalModel[] {
  return SHIPPED.map(entry => entry.model)
}

/** What the shipped catalogue offers for a role, in the order it offers them. */
export function shippedModelsFor(role: AiRoleId): readonly LocalModel[] {
  return SHIPPED.filter(entry => entry.role === role).map(entry => entry.model)
}

/** A shipped model by id, or nothing. Ids come from manifests, so an unknown one is expected. */
export function shippedModel(id: string): LocalModel | null {
  return SHIPPED.find(entry => entry.model.id === id)?.model ?? null
}

/** Which roles the shipped catalogue can serve at all, before any machine has a say. */
export function rolesWithLocalOption(): readonly AiRoleId[] {
  return [...new Set(SHIPPED.map(entry => entry.role))]
}

/**
 * Every shipped model passes the whitelist, checked here rather than trusted.
 *
 * A guard rather than a comment: the catalogue is where a model enters the studio, and ADR-20 puts
 * the whitelist at the point of INSTALL and not at the point of load.
 */
export function catalogueRefusals(): readonly { model: string; refusal: string }[] {
  return SHIPPED.flatMap(entry => {
    const refusal = modelRefusalOf(entry.model)
    return refusal === null ? [] : [{ model: entry.model.id, refusal }]
  })
}
