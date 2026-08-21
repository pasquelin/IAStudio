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

  it('serves a model this machine can run to the assistant', () => {
    expect(shippedModelsFor(ASSISTANT_ROLE).map(model => model.loader)).toEqual(['ollama'])
    expect(rolesWithLocalOption()).toEqual([DICTATION_ROLE, ASSISTANT_ROLE])
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
