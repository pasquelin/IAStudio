import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSLATIONS } from '@shared/i18n'
import { createDefaultScene } from '@/engines/scene/defaultScene'
import {
  forgetCarriedScene,
  sceneFromPayloadFile,
  scenePayloadOf,
  sceneRefusesToSave,
} from './sceneDocument'

const DOCUMENT = 'doc-scene'

/** What the load reported, so the case can read the sentence and not only its existence. */
const { notices } = vi.hoisted(() => ({ notices: [] as string[] }))

vi.mock('@/services/diagnostics', () => ({
  reportNotice: (_scope: string, message: string) => {
    notices.push(message)
  },
}))

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
  notices.length = 0
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

  /**
   * The refusal has to NAME what blocks it. Asserting only that it is not null would pass just as
   * well on an empty list of parts, which is a sentence with a hole in the middle.
   */
  it('names what it found, so the refusal is not a mystery', () => {
    sceneFromPayloadFile({ ...written(), animations: [], skins: [] }, DOCUMENT)

    expect(notices.at(-1)).toContain('animations')
    expect(notices.at(-1)).toContain('skins')
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /**
   * A node added elsewhere brings NO new root key — a Blender empty is one `nodes` entry, and a
   * camera adds only to `cameras`. Both members are composed, so nothing reported them, and a
   * save recomposes the nodes from the state alone: the object was erased without a word.
   */
  it('refuses to save one that came back holding a node the studio never wrote', () => {
    const payload = written()
    const nodes = Array.isArray(payload.nodes) ? payload.nodes : []

    sceneFromPayloadFile({ ...payload, nodes: [...nodes, { name: 'Empty' }] }, DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /** Never re-emitted at all, so a file carrying either comes back without it. */
  it('refuses to save one carrying required extensions or extras of its own', () => {
    sceneFromPayloadFile(
      { ...written(), extensionsRequired: ['KHR_draco_mesh_compression'] },
      DOCUMENT,
    )
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()

    forgetCarriedScene(DOCUMENT)
    sceneFromPayloadFile({ ...written(), extras: { pipeline: 'atelier' } }, DOCUMENT)
    expect(sceneRefusesToSave(DOCUMENT)).not.toBeNull()
  })

  /**
   * The lesson MaterialX taught, applied here: a root member this studio composes is NOT a
   * member it reproduces. `gltfDocumentOf` writes `scene: 0` and exactly ONE scene, so a file
   * holding three comes back holding one — and `scenes` being composed, nothing reported it.
   *
   * The studio's own scenes are KEPT and one is added. Replacing them, as this case used to,
   * drops the extras that carry the state — the node count then fires instead, and the case
   * passed with the scene check disarmed. `gltfDocument.test.ts` names each member it finds.
   */
  it('refuses to save one that came back holding more than one scene', () => {
    const held = written().scenes
    const two = {
      ...written(),
      scenes: [...(Array.isArray(held) ? held : []), { name: 'Plan large', nodes: [] }],
    }

    sceneFromPayloadFile(two, DOCUMENT)
    expect(notices.at(-1)).toContain('scenes')
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
