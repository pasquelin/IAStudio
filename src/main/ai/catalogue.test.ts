import { describe, expect, it } from 'vitest'
import {
  aiRoleId,
  allRoles,
  ASSISTANT_ROLE,
  DICTATION_ROLE,
  partsOfRole,
  type AiRoleId,
} from '@shared/domain/aiRole'
import { STT_MODEL } from '@shared/domain/dictation'
import type { LocalModel } from '@shared/domain/localModel'
import licences from '@shared/licences.json'
import {
  catalogueRefusals,
  rolesServedBy,
  rolesWithLocalOption,
  shippedModel,
  shippedModels,
  shippedModelsFor,
} from './catalogue'

describe('the shipped catalogue', () => {
  // ADR-20 § A puts the whitelist at the point of INSTALL, and the catalogue is where a model
  // enters the studio. A guard rather than a comment, so a model added later cannot slip past.
  it('holds nothing the whitelist refuses', () => {
    expect(catalogueRefusals()).toEqual([])
  })

  /**
   * ADR-20 § E asks that a licence travel WITH the weights. `collect-licences.mjs` cannot read
   * these manifests — it strips types and resolves no `@shared/` alias, and says so — so the
   * notices are retyped there by hand. This is what makes the omission redden: a third model
   * added without its line ships with no attribution, and no gate would have said a word.
   */
  it('gives every shipped model its line in the collected notices', () => {
    const collected = new Map(licences.map(entry => [entry.name, entry.spdx]))

    for (const model of shippedModels()) {
      expect(collected.get(model.name), `${model.name} has no notice`).toBe(model.licence)
    }
  })

  it('serves the recognition model to the dictation role', () => {
    expect(shippedModelsFor(DICTATION_ROLE)).toEqual([STT_MODEL])
  })

  // Several, from the lightest up: what a machine can hold is the person's call, so the catalogue
  // offers a range rather than one entry chosen for them.
  it('offers the assistant a range of models this studio can run itself', () => {
    const loaders = new Set(shippedModelsFor(ASSISTANT_ROLE).map(model => model.loader))

    expect(shippedModelsFor(ASSISTANT_ROLE).length).toBeGreaterThan(1)
    expect([...loaders]).toEqual(['llamacpp'])
  })

  /**
   * The two roles no catalogue entry can be missing FIRST, whatever else grows beside them: a
   * pinned list would go red at every role added, which says nothing about either of these.
   */
  it('serves the two roles that came before any generation did', () => {
    expect(rolesWithLocalOption()).toContain(DICTATION_ROLE)
    expect(rolesWithLocalOption()).toContain(ASSISTANT_ROLE)
  })

  // Several, from the lightest up, for the reason the assistant already has: what a machine can
  // hold is the person's call, and one entry chosen for them is not a choice.
  it('offers an image role a range of models that generate rather than converse', () => {
    const image = shippedModelsFor(aiRoleId('image', 'txt2img'))

    expect(image.length).toBeGreaterThan(1)
    expect(new Set(image.map(model => model.modality))).toEqual(new Set(['image']))
  })

  // Lightest first, because the FIRST usable entry is what a role takes on its own. Every role
  // and not the assistant alone: the one pinned to a role went green on the day a second one
  // gained a second model, and said nothing about it.
  it('orders each role from the lightest model up', () => {
    for (const role of rolesWithLocalOption()) {
      const sizes = shippedModelsFor(role).map(model => model.diskBytes)

      expect(sizes, role).toEqual([...sizes].sort((one, other) => one - other))
    }
  })

  /**
   * The figure a disk verdict and the size on screen are both read from. A model that ships a file
   * list must agree with it — `diskBytes` is declared rather than summed only because a
   * runtime-pulled model has no list here, and the two must not drift for the ones that do.
   */
  it('declares on disk exactly what the files it ships weigh', () => {
    const drifted = shippedModels()
      .filter(model => model.files.length > 0)
      .filter(model => model.diskBytes !== model.files.reduce((sum, file) => sum + file.bytes, 0))

    expect(drifted).toEqual([])
  })

  /**
   * A conversation needs a window, and the brain reads it to decide what to trim. Without one it
   * would fall back on Ollama's own 2048, and the studio's preamble would be cut from the HEAD.
   */
  it('gives every model that answers the assistant a context window', () => {
    const windowless = shippedModelsFor(ASSISTANT_ROLE).filter(
      model => model.contextTokens === undefined,
    )

    expect(windowless).toEqual([])
  })

  it('finds a model by the id its manifest carries', () => {
    expect(shippedModel(STT_MODEL.id)).toBe(STT_MODEL)
  })

  // Ids come from manifests, including ones a person supplies, so an unknown id is expected
  // rather than exceptional.
  it('answers nothing for an id it does not ship', () => {
    expect(shippedModel('not-a-shipped-model')).toBeNull()
  })

  it('lists every shipped model once', () => {
    const models = shippedModels()

    expect(models).toContain(STT_MODEL)
    expect(new Set(models.map(model => model.id)).size).toBe(models.length)
  })
})

describe('one entry, several employments', () => {
  /**
   * `img2img` and `inpaint` run on the weights `txt2img` already downloaded. Three entries would
   * fetch the same 4.47 GB three times, show three cards, and let deleting one take the other
   * two's files — what tells the three apart is the FORM, never a second manifest.
   */
  it('serves editing and repainting from the entry that serves drawing', () => {
    const idsFor = (capability: string) =>
      shippedModelsFor(aiRoleId('image', capability)).map(model => model.id)

    for (const capability of ['txt2img', 'img2img', 'inpaint', 'outpaint']) {
      expect(idsFor(capability), capability).toContain('ssd-1b')
    }
    // And a texture is an image: the same weights, filed on another shelf.
    expect(shippedModelsFor(aiRoleId('texture', 'txt2img_texture')).length).toBeGreaterThan(0)
  })

  it('lists a model that serves three employments once, not three times', () => {
    const ids = shippedModels().map(model => model.id)

    expect(ids.filter(id => id === 'ssd-1b')).toEqual(['ssd-1b'])
  })
})

describe('how many employments one download answers for', () => {
  /**
   * The catalogue holds more models than employments, and the difference between them is not
   * quality: one entry serves six for 4.47 GB where another serves one for 133. The figure is
   * said on screen so the choice can be made on it — it ranks nothing.
   */
  it('counts every employment a model is filed under', () => {
    expect(rolesServedBy('ssd-1b')).toBeGreaterThan(1)
    expect(rolesServedBy('ssd-1b')).toBe(
      allRoles().filter(role => shippedModelsFor(role).some(model => model.id === 'ssd-1b')).length,
    )
  })

  it('answers nothing for a model the catalogue does not ship', () => {
    expect(rolesServedBy('not-a-shipped-model')).toBe(0)
  })
})

describe('what a manifest owes the panel', () => {
  /**
   * 🛑 Measured 2026-08-22, and it cost a request to the API: without a family,
   * `localSummaryOf` answers null, `describedLocally` fell through, and a LOCAL model id was sent
   * to Scenario — `404 Model ssd-1b not found`, journalled as a generation failure. Fifteen of
   * twenty-nine entries were in that state. The registry no longer falls through, and this keeps
   * the manifests themselves honest: a model filed under an employment says which one.
   */
  it('gives every generation model the family and capability its employment names', () => {
    const naked = allRoles()
      .flatMap(role => shippedModelsFor(role).map(model => ({ role, model })))
      .filter(({ role, model }) => partsOfRole(role) !== null && !servesTheRole(model, role))
      .map(({ role, model }) => `${model.id} under ${role}`)

    expect(naked).toEqual([])
  })
})

/** Whether the manifest itself says it serves this employment, rather than the JSON key alone. */
function servesTheRole(model: LocalModel, role: AiRoleId): boolean {
  const parts = partsOfRole(role)
  if (!parts) return false

  const withinFamily = model.family === parts.family && (model.capabilities ?? []).length > 0
  return withinFamily || (model.serves ?? []).includes(role)
}
