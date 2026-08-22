import {
  aiRoleId,
  ASSISTANT_ROLE,
  DICTATION_ROLE,
  partsOfRole,
  type AiRoleId,
} from '@shared/domain/aiRole'
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
    (models as LocalModel[]).flatMap(model =>
      rolesOf(model, role as AiRoleId).map(one => ({
        role: one,
        model,
      })),
    ),
  )
}

/**
 * Every employment one entry serves — its JSON key, plus one per capability it declares.
 *
 * ONE entry and not three, and the difference is gigabytes: `img2img` and `inpaint` run on the
 * weights `txt2img` already downloaded, so three entries would fetch the same 4.47 GB three
 * times, show three cards, and let deleting one take the other two's files. What tells the three
 * apart is the FORM — a starting image, a mask — never a second manifest.
 */
function rolesOf(model: LocalModel, key: AiRoleId): readonly AiRoleId[] {
  const family = model.family
  const withinFamily =
    family && model.capabilities ? model.capabilities.map(one => aiRoleId(family, one)) : []

  // `serves` is already `<family>/<capability>`, and `partsOfRole` is what refuses a malformed
  // one — a role composed from data cannot be trusted the way one composed from constants is.
  const elsewhere = (model.serves ?? []).flatMap(role => {
    const parts = partsOfRole(role as AiRoleId)
    return parts ? [aiRoleId(parts.family, parts.capability)] : []
  })

  return [...new Set([key, ...withinFamily, ...elsewhere])]
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

/**
 * The same list, indexed the two ways it is ever read — built ONCE.
 *
 * `[M]` `shippedModelsFor` used to `filter` and `map` the frozen list per role, and a compose asks
 * it once per role: twenty-two arrays allocated to answer a question whose answer cannot change.
 */
const BY_ROLE: ReadonlyMap<AiRoleId, readonly LocalModel[]> = (() => {
  const map = new Map<AiRoleId, LocalModel[]>()
  for (const entry of SHIPPED) {
    const held = map.get(entry.role) ?? []
    held.push(entry.model)
    map.set(entry.role, held)
  }

  return map
})()

const BY_ID: ReadonlyMap<string, LocalModel> = new Map(
  SHIPPED.map(entry => [entry.model.id, entry.model]),
)

/** ONCE each, however many employments it serves: one manifest is one card and one download. */
const ALL: readonly LocalModel[] = [...new Map(SHIPPED.map(e => [e.model.id, e.model])).values()]

const NONE: readonly LocalModel[] = []

/** Every shipped model, whatever role it serves. */
export function shippedModels(): readonly LocalModel[] {
  return ALL
}

/** What the shipped catalogue offers for a role, in the order it offers them. */
export function shippedModelsFor(role: AiRoleId): readonly LocalModel[] {
  return BY_ROLE.get(role) ?? NONE
}

/** A shipped model by id, or nothing. Ids come from manifests, so an unknown one is expected. */
export function shippedModel(id: string): LocalModel | null {
  return BY_ID.get(id) ?? null
}

/** Which roles the shipped catalogue can serve at all, before any machine has a say. */
export function rolesWithLocalOption(): readonly AiRoleId[] {
  return [...BY_ROLE.keys()]
}

/** The only loader a supplied file reaches today is llama.cpp, and it serves the conversation. */
const OWN_MODEL_ROLE: AiRoleId = ASSISTANT_ROLE

/** The catalogue as a whole — and the ONE place the shipped list and the supplied one meet. */
export function catalogueWith(own: readonly LocalModel[]): readonly LocalModel[] {
  return own.length === 0 ? ALL : [...ALL, ...own]
}

/** What a role can be served by, from both lists. */
export function modelsForWith(role: AiRoleId, own: readonly LocalModel[]): readonly LocalModel[] {
  const shipped = shippedModelsFor(role)
  return role === OWN_MODEL_ROLE && own.length > 0 ? [...shipped, ...own] : shipped
}

/** One model by id, from either list. An unknown id is expected: manifests come and go. */
export function modelWith(id: string, own: readonly LocalModel[]): LocalModel | null {
  return BY_ID.get(id) ?? own.find(model => model.id === id) ?? null
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
