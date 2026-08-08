import { describe, expect, it } from 'vitest'
import { MESH_ENTRIES, TEXTURE_SLOTS } from '@shared/domain/scene'
import { MESH_PRIMITIVES } from './mesh-primitives'
import { LIGHT_TYPES } from './light-types'
import { lightNodeFixture as light, meshNode as mesh, modelNodeFixture } from './scene-fixtures'
import { scenePayload, sceneFromPayload } from './scene-document'
import { DEFAULT_MATERIAL, EMPTY_SCENE, IDENTITY_TRANSFORM, type SceneState } from './scene-state'

/** A payload as it comes back from disk: through JSON, so nothing keeps a live reference. */
function reread(state: SceneState): SceneState {
  return sceneFromPayload(JSON.parse(JSON.stringify(scenePayload(state))))
}

const nodeWith = (fields: object): unknown => ({ ...mesh('a'), ...fields })

describe('scenePayload', () => {
  it('carries the nodes and leaves the selection behind', () => {
    const state: SceneState = { nodes: [mesh('a')], selectedIds: ['a'] }
    expect(scenePayload(state)).toEqual({ nodes: [mesh('a')] })
  })
})

describe('sceneFromPayload', () => {
  it('round-trips a scene through what is written to disk', () => {
    const state: SceneState = { nodes: [mesh('a'), light('b')], selectedIds: ['a'] }
    expect(reread(state)).toEqual({ nodes: [mesh('a'), light('b')], selectedIds: [] })
  })

  it('round-trips every primitive the studio can build', () => {
    const nodes = MESH_PRIMITIVES.flatMap((primitive, index) =>
      primitive.create ? [{ ...mesh(`mesh-${index}`), geometry: primitive.create() }] : [],
    )

    expect(reread({ nodes, selectedIds: [] }).nodes).toHaveLength(
      MESH_ENTRIES.filter(entry => !entry.disabled).length,
    )
  })

  it('round-trips every kind of light', () => {
    const nodes = LIGHT_TYPES.map((type, index) => light(`light-${index}`, type.create()))
    expect(reread({ nodes, selectedIds: [] }).nodes).toHaveLength(nodes.length)
  })

  it('keeps a material dressed with textures', () => {
    const dressed = {
      ...mesh('a'),
      material: {
        ...DEFAULT_MATERIAL,
        color: '#ff0000',
        map: { assetId: 'asset_1' },
      },
    }

    expect(reread({ nodes: [dressed], selectedIds: [] }).nodes).toEqual([dressed])
  })

  it('yields an empty scene for a payload that is not one', () => {
    expect(sceneFromPayload(null)).toEqual(EMPTY_SCENE)
    expect(sceneFromPayload({ nodes: 'nope' })).toEqual(EMPTY_SCENE)
    expect(sceneFromPayload('{}')).toEqual(EMPTY_SCENE)
  })

  it('opens with nothing selected, whatever the file says', () => {
    expect(sceneFromPayload({ nodes: [], selectedIds: ['a'] }).selectedIds).toEqual([])
  })

  // A model is a reference and nothing else — what it points at is resolved when the scene is
  // built, so a project whose assets moved still opens.
  it('carries an imported model through a round trip', () => {
    const model = modelNodeFixture('m')
    expect(reread({ nodes: [model], selectedIds: [] }).nodes).toEqual([model])
  })

  it('drops a model whose reference says nothing, and keeps the rest of the scene', () => {
    const nodes: unknown[] = [
      mesh('a'),
      { ...modelNodeFixture('m'), model: {} },
      { ...modelNodeFixture('n'), model: { assetId: 42 } },
      { ...modelNodeFixture('o'), model: null },
    ]

    expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a'])
  })

  it('keeps a model pointing at an asset nothing answers to, which is a project that moved', () => {
    const ghost = modelNodeFixture('m', 'gone')
    expect(reread({ nodes: [ghost], selectedIds: [] }).nodes).toEqual([ghost])
  })

  /**
   * The silent risk of the whole shadow change: every document written so far has no flags, and
   * requiring them would have emptied each of them at load — a dropped node looks exactly like
   * one that was never there.
   */
  describe('a document written before shadows existed', () => {
    const before = (node: object): Record<string, unknown> => {
      const stripped: Record<string, unknown> = { ...node }
      delete stripped.castShadow
      delete stripped.receiveShadow
      return stripped
    }

    it('keeps its nodes rather than dropping them', () => {
      const nodes = [before(mesh('a')), before(light('b')), before(modelNodeFixture('m'))]
      expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a', 'b', 'm'])
    })

    it('gives a mesh both flags, so a scene reads as lit rather than as cut-outs', () => {
      const [node] = sceneFromPayload({ nodes: [before(mesh('a'))] }).nodes
      expect(node).toMatchObject({ castShadow: true, receiveShadow: true })
    })

    // A point light with shadows is six renders of the scene a frame, and a spot is one.
    it('only lets a directional light throw shadows by default', () => {
      const directional = light('d', {
        kind: 'directional',
        color: '#fff',
        intensity: 1,
        target: { x: 0, y: 0, z: 0 },
      })
      const point = light('p', {
        kind: 'point',
        color: '#fff',
        intensity: 1,
        distance: 0,
        decay: 2,
      })

      const nodes = sceneFromPayload({ nodes: [before(directional), before(point)] }).nodes
      expect(nodes.map(node => node.castShadow)).toEqual([true, false])
    })

    it('leaves a flag the file does hold alone', () => {
      const kept = { ...mesh('a'), castShadow: false, receiveShadow: false }
      expect(sceneFromPayload({ nodes: [kept] }).nodes[0]).toMatchObject({ castShadow: false })
    })
  })

  it.each([
    ['no id', nodeWith({ id: '' })],
    ['a shadow flag that is not a flag', nodeWith({ castShadow: 'yes' })],
    ['a parent that is not a reference', nodeWith({ parentId: 7 })],
    ['no name', nodeWith({ name: null })],
    ['a visibility that is not a flag', nodeWith({ visible: 'yes' })],
    ['a transform missing an axis', nodeWith({ transform: { ...IDENTITY_TRANSFORM, scale: {} } })],
    ['a type nothing renders', nodeWith({ type: 'camera' })],
    ['a geometry of an unknown kind', nodeWith({ geometry: { kind: 'blob', radius: 1 } })],
    ['a geometry missing a parameter', nodeWith({ geometry: { kind: 'box', width: 1 } })],
    ['a geometry whose parameter is text', nodeWith({ geometry: { kind: 'sphere', radius: '1' } })],
    [
      'a material of an unknown kind',
      nodeWith({ material: { ...DEFAULT_MATERIAL, kind: 'toon' } }),
    ],
    ['a material missing a slot', nodeWith({ material: { ...DEFAULT_MATERIAL, map: undefined } })],
    ['a texture without an asset', nodeWith({ material: { ...DEFAULT_MATERIAL, map: {} } })],
  ])('drops a node with %s', (_case, node) => {
    expect(sceneFromPayload({ nodes: [node] }).nodes).toEqual([])
  })

  it('drops a light whose descriptor is incomplete', () => {
    const broken = { ...light('a'), light: { kind: 'spot', color: '#fff', intensity: 1 } }
    expect(sceneFromPayload({ nodes: [broken] }).nodes).toEqual([])
  })

  it('refuses a number JSON cannot hold, rather than building a mesh from Infinity', () => {
    const overflowing: unknown = JSON.parse('{"nodes":[{"geometry":{"radius":1e999}}]}')
    expect(sceneFromPayload(overflowing).nodes).toEqual([])
  })

  it('keeps the good nodes around a bad one', () => {
    const nodes = [mesh('a'), nodeWith({ id: 'bad', geometry: { kind: 'blob' } }), mesh('c')]
    expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a', 'c'])
  })

  it('names every texture slot a dressed material has to carry', () => {
    for (const slot of TEXTURE_SLOTS) {
      const stripped: Record<string, unknown> = { ...DEFAULT_MATERIAL }
      delete stripped[slot]
      expect(sceneFromPayload({ nodes: [nodeWith({ material: stripped })] }).nodes).toEqual([])
    }
  })
})
