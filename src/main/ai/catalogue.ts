import { ASSISTANT_ROLE, DICTATION_ROLE, type AiRoleId } from '@shared/domain/aiRole'
import { STT_MODEL } from '@shared/domain/dictation'
import { modelRefusalOf, type LocalModel } from '@shared/domain/localModel'

/**
 * The one model a runtime pulls for itself rather than one the studio fetches — hence no `files`
 * and no digest: none of its bytes pass through here. Its `id` IS the tag Ollama knows it by.
 *
 * `[M]` Every figure measured 2026-08-21 against Ollama 0.4.6 on Apple M2 Max. `/api/tags` gives
 * 2 019 393 189 bytes on disk and `gguf`; `/api/ps` gives 5.42 GB loaded at a 4096 window and
 * 8.21 GB at 8192. The larger window is what is asked for and what the reservation is written
 * against: the studio's preamble alone is some fifteen hundred tokens, and `HISTORY_MAX` is ten
 * blocks — 4096 would be spent before the conversation started.
 */
const LLAMA_MODEL: LocalModel = {
  id: 'llama3.2:3b',
  name: 'Llama 3.2 3B',
  format: 'gguf',
  loader: 'ollama',
  rank: 1,
  // Not on the SPDX list, so a `LicenseRef-`, which is what SPDX itself says to write for one.
  licence: 'LicenseRef-Llama-3.2-Community',
  licenceUrl: 'https://github.com/meta-llama/llama-models/blob/main/models/llama3_2/LICENSE',
  source: 'https://ollama.com/library/llama3.2',
  files: [],
  diskBytes: 2_019_393_189,
  contextTokens: 8192,
  reservationBytes: 8_207_560_704,
}

/**
 * The models the application ships the MANIFEST of — rank 1 of ADR-20, versioned with the binary.
 *
 * Two, and the pair is the point: one whose weights the studio fetches file by file against a
 * digest, one a runtime pulls for itself. A model enters this list only once something can install
 * it — a plausible catalogue costs more than a short one, because its entries lead nowhere.
 */
const SHIPPED: readonly { readonly role: AiRoleId; readonly model: LocalModel }[] = [
  { role: DICTATION_ROLE, model: STT_MODEL },
  { role: ASSISTANT_ROLE, model: LLAMA_MODEL },
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
