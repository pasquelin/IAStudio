import { DICTATION_ROLE, type AiRoleId } from '@shared/domain/aiRole'
import { STT_MODEL } from '@shared/domain/dictation'
import { modelRefusalOf, type LocalModel } from '@shared/domain/localModel'
import localModels from '@shared/domain/localModels.json'

/**
 * The shipped list, read off the JSON and keyed by the role each entry serves.
 *
 * Cast once, here: a JSON import widens every union to `string`, and the shape is held by
 * `catalogue.test.ts` rather than by a parser nothing else would use.
 */
function catalogueEntries(): readonly { role: AiRoleId; model: LocalModel }[] {
  return Object.entries(localModels).flatMap(([role, models]) =>
    (models as LocalModel[]).map(model => ({ role: role as AiRoleId, model })),
  )
}

/**
 * The models the application ships the MANIFEST of — rank 1 of ADR-20, versioned with the binary.
 *
 * The list is DATA (`localModels.json`), so a model is added without recompiling anything and its
 * digests are written by `pin-models.mjs` rather than by hand. The recognition model joins from
 * `dictation.ts`, which owns it: its files are what the engine there loads by name.
 *
 * 🛑 A model enters this list only once its runtime is wired. A catalogue that offers a download
 * for an engine the studio does not carry costs someone gigabytes for nothing — which is worse
 * than not offering it, and is not the same thing as deciding for them what their machine can hold.
 */
const SHIPPED: readonly { readonly role: AiRoleId; readonly model: LocalModel }[] = [
  { role: DICTATION_ROLE, model: STT_MODEL },
  ...catalogueEntries(),
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
