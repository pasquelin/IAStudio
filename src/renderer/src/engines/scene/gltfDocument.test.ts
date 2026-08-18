import { describe, expect, it } from 'vitest'
import { DOCUMENT_ID_KEY, DOCUMENT_KIND_KEY, STUDIO_METADATA_KEY } from '@shared/domain/document'
import { gltfStudioMetadata, isGltfDocument } from '@shared/domain/gltf'
import { isRecord } from '@shared/guards'
import {
  gltfDocumentOf,
  sceneFromGltf,
  sceneHoldsMore,
  type GltfDocumentOptions,
} from './gltfDocument'
import { cameraNodeFixture, lightNodeFixture, meshNode } from './scene-fixtures'
import { EMPTY_SCENE, type SceneState } from './sceneState'

const WRITTEN: GltfDocumentOptions = { documentId: 'doc-1', documentKind: 'scene' }

function write(state: SceneState): Record<string, unknown> {
  const document = gltfDocumentOf(state, WRITTEN)
  if (!isRecord(document)) throw new Error('not a document')
  return document
}

/** What a reader walks: the nodes array, checked for shape rather than trusted. */
function nodesOf(document: Record<string, unknown>): Record<string, unknown>[] {
  const nodes = document.nodes
  return Array.isArray(nodes) ? nodes.filter(isRecord) : []
}

describe('gltfDocumentOf', () => {
  it('writes a file another application reads as glTF', () => {
    const document = write(EMPTY_SCENE)

    expect(isGltfDocument(document)).toBe(true)
    expect(document.scene).toBe(0)
  })

  it('says which document it is, and which kind, where the file name cannot', () => {
    const studio = gltfStudioMetadata(write(EMPTY_SCENE))

    expect(studio[DOCUMENT_ID_KEY]).toBe('doc-1')
    expect(studio[DOCUMENT_KIND_KEY]).toBe('scene')
  })

  it('hangs a child under its parent, and roots the rest', () => {
    const child = { ...meshNode('child'), parentId: 'parent' }
    const document = write({ ...EMPTY_SCENE, nodes: [meshNode('parent'), child] })

    expect(nodesOf(document)[0]?.children).toEqual([1])
    expect(nodesOf(document)[1]?.children).toBeUndefined()
    const scenes = document.scenes
    expect(Array.isArray(scenes) && isRecord(scenes[0]) ? scenes[0].nodes : null).toEqual([0])
  })

  it('leaves out a placement that is the default, and writes one that is not', () => {
    const moved = meshNode('moved')
    moved.transform = { ...moved.transform, position: { x: 1, y: 2, z: 3 } }
    const document = write({ ...EMPTY_SCENE, nodes: [meshNode('still'), moved] })

    expect(nodesOf(document)[0]).toEqual({ name: 'still' })
    expect(nodesOf(document)[1]?.translation).toEqual([1, 2, 3])
  })

  it('writes a camera the standard way, its angle in radians', () => {
    const document = write({ ...EMPTY_SCENE, nodes: [cameraNodeFixture('cam', { fov: 90 })] })
    const cameras = document.cameras

    expect(nodesOf(document)[0]?.camera).toBe(0)
    const first = Array.isArray(cameras) && isRecord(cameras[0]) ? cameras[0] : {}
    expect(first.type).toBe('perspective')
    expect(isRecord(first.perspective) ? first.perspective.yfov : null).toBeCloseTo(Math.PI / 2, 6)
  })

  it('writes a punctual light under the extension, and declares it', () => {
    const document = write({
      ...EMPTY_SCENE,
      nodes: [
        lightNodeFixture('spot', {
          kind: 'spot',
          color: '#ffffff',
          intensity: 2,
          distance: 8,
          angle: 1,
          penumbra: 0.5,
          decay: 2,
          target: { x: 0, y: 0, z: 0 },
        }),
      ],
    })

    expect(document.extensionsUsed).toEqual(['KHR_lights_punctual'])
    const extensions = isRecord(document.extensions)
      ? document.extensions.KHR_lights_punctual
      : null
    const lights = isRecord(extensions) ? extensions.lights : null
    const light = Array.isArray(lights) && isRecord(lights[0]) ? lights[0] : {}
    expect(light.type).toBe('spot')
    expect(light.intensity).toBe(2)
    expect(light.range).toBe(8)
    expect(light.spot).toEqual({ innerConeAngle: 0.5, outerConeAngle: 1 })
  })

  it('leaves an ambient light out of the extension, having no type for it', () => {
    const document = write({ ...EMPTY_SCENE, nodes: [lightNodeFixture('ambient')] })

    expect(document.extensionsUsed).toBeUndefined()
    expect(nodesOf(document)[0]?.extensions).toBeUndefined()
  })
})

describe('sceneFromGltf', () => {
  it('gives back the scene that was written, node for node', () => {
    const state: SceneState = {
      ...EMPTY_SCENE,
      nodes: [meshNode('box'), cameraNodeFixture('cam'), lightNodeFixture('ambient')],
    }

    expect(sceneFromGltf(write(state))).toEqual({ ...state, selectedIds: [] })
  })

  it('answers an empty scene for a glTF no studio wrote', () => {
    expect(sceneFromGltf({ asset: { version: '2.0' }, scenes: [{ nodes: [] }] })).toEqual(
      EMPTY_SCENE,
    )
  })

  it('reads the scene the document points at, not the first one written', () => {
    const document = write({ ...EMPTY_SCENE, nodes: [meshNode('box')] })
    const scenes = document.scenes
    const held = Array.isArray(scenes) ? scenes[0] : {}

    // The studio's own scene second, and pointed at: a reader that took the first would answer
    // for a scene holding nothing.
    expect(
      sceneFromGltf({
        ...document,
        scene: 1,
        scenes: [{ name: 'other', extras: { [STUDIO_METADATA_KEY]: {} } }, held],
      }).nodes,
    ).toHaveLength(1)
  })
})

/**
 * Each case asserts WHICH member was found, never that something was.
 *
 * The suite next door asserted only that the refusal existed, and its fixture REPLACED `scenes` —
 * which drops the extras carrying the state, so the node count fired instead. Disarming the scene
 * check therefore left every case green, measured 18/08 on the whole 10 326.
 */
describe('sceneHoldsMore', () => {
  const written = (): Record<string, unknown> => write({ ...EMPTY_SCENE, nodes: [meshNode('a')] })

  const enriched = (over: Record<string, unknown>): Record<string, unknown> => ({
    ...written(),
    ...over,
  })

  it('finds nothing in a file it wrote itself', () => {
    expect(sceneHoldsMore(written())).toEqual([])
  })

  /** The case the suite next door could not see: the studio's own scenes KEPT, plus one. */
  it('names the second scene of a file holding two', () => {
    const scenes = written().scenes
    const two = enriched({
      scenes: [...(Array.isArray(scenes) ? scenes : []), { name: 'Plan large', nodes: [] }],
    })

    expect(sceneHoldsMore(two)).toEqual(['scenes'])
  })

  it('names the node a file gained beside the ones the state holds', () => {
    const nodes = written().nodes
    const more = enriched({ nodes: [...(Array.isArray(nodes) ? nodes : []), { name: 'Empty' }] })

    expect(sceneHoldsMore(more)).toEqual(['nodes'])
  })

  it('names an asset field beyond the ones a save writes back', () => {
    expect(sceneHoldsMore(enriched({ asset: { version: '2.0', copyright: 'Atelier' } }))).toEqual([
      'asset.copyright',
    ])
  })

  it('names an extension the file declares beside the lights one', () => {
    const variants = enriched({
      extensionsUsed: ['KHR_lights_punctual', 'KHR_materials_variants'],
    })

    expect(sceneHoldsMore(variants)).toEqual(['KHR_materials_variants'])
  })

  it('names a root member this studio never writes', () => {
    expect(sceneHoldsMore(enriched({ extensionsRequired: ['KHR_draco_mesh_compression'] }))).toEqual(
      ['extensionsRequired'],
    )
    expect(sceneHoldsMore(enriched({ meshes: [{ primitives: [] }] }))).toEqual(['meshes'])
  })

  /** A scene written before the studio wrote glTF is not one, so there is nothing to measure. */
  it('answers nothing at all for a payload that is not a glTF document', () => {
    expect(sceneHoldsMore({ nodes: [], selection: [] })).toEqual([])
  })
})
