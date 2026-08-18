import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TRANSLATIONS } from '@shared/i18n'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import {
  forgetCarriedScene,
  sceneFromPayloadFile,
  scenePayloadOf,
  sceneRefusesToSave,
} from './sceneDocument'

const DOCUMENT = 'doc-scene'

beforeAll(async () => {
  await i18next.init({
    lng: 'fr',
    defaultNS: 'studio',
    resources: { fr: { studio: TRANSLATIONS.fr } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  forgetCarriedScene(DOCUMENT)
})

/** What a save writes: the whole document, recomposed from the state and from nothing else. */
const written = (): Record<string, unknown> =>
  scenePayloadOf(createDefaultScene(), DOCUMENT) as Record<string, unknown>

describe('a scene on its way back from its file', () => {
  it('saves a file the studio composed whole', () => {
    sceneFromPayloadFile(written(), DOCUMENT)

    expect(sceneRefusesToSave(DOCUMENT)).toBeNull()
  })

  /**
   * The defect this exists for: a scene the studio wrote, opened in Blender, saved back with its
   * meshes in it. Its extras are still OURS, so it lists and it opens — and `gltfDocumentOf`
   * recomposes the document from the state, which holds none of them. Without this, ⌘S deletes
   * every mesh in the file and nothing says so.
   */
  it('refuses to save one that came back holding meshes', () => {
    sceneFromPayloadFile(
      { ...written(), meshes: [{ primitives: [] }], accessors: [], buffers: [] },
      DOCUMENT,
    )

    expect(sceneRefusesToSave(DOCUMENT)).toContain('glTF')
  })

  it('names what it found, so the refusal is not a mystery', () => {
    sceneFromPayloadFile({ ...written(), animations: [] }, DOCUMENT)

    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /**
   * The lesson MaterialX taught, applied here: a root member this studio composes is NOT a
   * member it reproduces. `gltfDocumentOf` writes `scene: 0` and exactly ONE scene, so a file
   * holding three comes back holding one — and `scenes` being composed, nothing reported it.
   */
  it('refuses to save one that came back holding more than one scene', () => {
    const two = { ...written(), scenes: [{ nodes: [] }, { name: 'Plan large', nodes: [] }] }

    sceneFromPayloadFile(two, DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /** `asset` is rewritten from two fields, so a `copyright` another application set is dropped. */
  it('refuses to save one whose asset carries more than the studio writes', () => {
    const credited = { ...written(), asset: { version: '2.0', copyright: 'Atelier' } }

    sceneFromPayloadFile(credited, DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /** The extension block is overwritten whole, so any extension but the lights one is lost. */
  it('refuses to save one using an extension the studio does not write', () => {
    const variants = {
      ...written(),
      extensionsUsed: ['KHR_lights_punctual', 'KHR_materials_variants'],
    }

    sceneFromPayloadFile(variants, DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /** A file that lost its extra parts opens clean again — the refusal is not sticky. */
  it('lifts the refusal when the file comes back without them', () => {
    sceneFromPayloadFile({ ...written(), meshes: [] }, DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()

    sceneFromPayloadFile(written(), DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).toBeNull()
  })

  /**
   * A scene written before the studio wrote glTF is not a glTF at all, so there is nothing in it
   * this could measure — refusing it would take every one of them out of reach.
   */
  it('refuses nothing for a scene written the studio own way', () => {
    sceneFromPayloadFile({ nodes: [], selection: [] }, DOCUMENT)

    expect(sceneRefusesToSave(DOCUMENT)).toBeNull()
  })

  it('drops the refusal with the document, so a reopened id does not inherit it', () => {
    sceneFromPayloadFile({ ...written(), meshes: [] }, DOCUMENT)
    forgetCarriedScene(DOCUMENT)

    expect(sceneRefusesToSave(DOCUMENT)).toBeNull()
  })
})
