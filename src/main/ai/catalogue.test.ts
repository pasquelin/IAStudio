import { describe, expect, it } from 'vitest'
import { ASSISTANT_ROLE, DICTATION_ROLE } from '@shared/domain/aiRole'
import { STT_MODEL } from '@shared/domain/dictation'
import {
  catalogueRefusals,
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

  it('serves the recognition model to the dictation role', () => {
    expect(shippedModelsFor(DICTATION_ROLE)).toEqual([STT_MODEL])
  })

  // Measured rather than a gap: the assistant has no shipped model because the studio cannot yet
  // install one — `ollama pull` works, the adapter that asks for it does not exist.
  it('offers nothing for a role it cannot install for', () => {
    expect(shippedModelsFor(ASSISTANT_ROLE)).toEqual([])
    expect(rolesWithLocalOption()).toEqual([DICTATION_ROLE])
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
