import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { describe, expect, it } from 'vitest'
import { MESH_ENTRIES, TEXTURE_SLOTS } from '@shared/domain/scene'
import { MESH_PRIMITIVES } from './meshPrimitives'
import { LIGHT_TYPES } from './lightTypes'
import {
  lightNodeFixture as light,
  meshNode as mesh,
  modelNodeFixture,
  pathNodeFixture,
  spriteNodeFixture,
  textNodeFixture,
} from './scene-fixtures'
import { groupNode } from './nodeFactory'
import { SPRITE_SPECS } from './propertyFields'
import { scenePayload, sceneFromPayload } from './sceneDocument'
import {
  DEFAULT_MATERIAL,
  DEFAULT_SPRITE,
  DEFAULT_TEXT,
  EMPTY_SCENE,
  IDENTITY_TRANSFORM,
  type SceneState,
} from './sceneState'

/** A payload as it comes back from disk: through JSON, so nothing keeps a live reference. */
function reread(state: SceneState): SceneState {
  return sceneFromPayload(JSON.parse(JSON.stringify(scenePayload(state))))
}

const nodeWith = (fields: object): unknown => ({ ...mesh('a'), ...fields })

describe('scenePayload', () => {
  it('carries the nodes, what lights them and what moves them, and leaves the selection behind', () => {
    const state: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a')], selectedIds: ['a'] }
    expect(scenePayload(state)).toEqual({
      nodes: [mesh('a')],
      environment: { kind: 'studio' },
      animation: EMPTY_TIMELINE,
    })
  })
})

describe('sceneFromPayload', () => {
  it('round-trips a scene through what is written to disk', () => {
    const state: SceneState = { ...EMPTY_SCENE, nodes: [mesh('a'), light('b')], selectedIds: ['a'] }
    expect(reread(state)).toEqual({
      ...EMPTY_SCENE,
      nodes: [mesh('a'), light('b')],
      selectedIds: [],
    })
  })

  it('round-trips every primitive the studio can build', () => {
    const nodes = MESH_PRIMITIVES.flatMap((primitive, index) =>
      primitive.create ? [{ ...mesh(`mesh-${index}`), geometry: primitive.create() }] : [],
    )

    expect(reread({ ...EMPTY_SCENE, nodes }).nodes).toHaveLength(
      MESH_ENTRIES.filter(entry => !entry.disabled).length,
    )
  })

  it('round-trips every kind of light', () => {
    const nodes = LIGHT_TYPES.map((type, index) => light(`light-${index}`, type.create()))
    expect(reread({ ...EMPTY_SCENE, nodes }).nodes).toHaveLength(nodes.length)
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

    expect(reread({ ...EMPTY_SCENE, nodes: [dressed], selectedIds: [] }).nodes).toEqual([dressed])
  })

  it('yields an empty scene for a payload that is not one', () => {
    expect(sceneFromPayload(null)).toEqual(EMPTY_SCENE)
    expect(sceneFromPayload({ nodes: 'nope' })).toEqual(EMPTY_SCENE)
    expect(sceneFromPayload('{}')).toEqual(EMPTY_SCENE)
  })

  it('opens with nothing selected, whatever the file says', () => {
    expect(sceneFromPayload({ ...EMPTY_SCENE, nodes: [], selectedIds: ['a'] }).selectedIds).toEqual(
      [],
    )
  })

  // A model is a reference and nothing else — what it points at is resolved when the scene is
  // built, so a project whose assets moved still opens.
  it('carries an imported model through a round trip', () => {
    const model = modelNodeFixture('m')
    expect(reread({ ...EMPTY_SCENE, nodes: [model], selectedIds: [] }).nodes).toEqual([model])
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

  it('carries the maps put over a model own through a round trip', () => {
    const model = modelNodeFixture('m')
    model.model = { ...model.model, textures: { map: { assetId: 'tex-1' } } }

    expect(reread({ ...EMPTY_SCENE, nodes: [model], selectedIds: [] }).nodes).toEqual([model])
  })

  // A slot spelled with something that is not a reference would come back as a model missing one
  // map with nothing said — the node is refused instead, like a malformed animation.
  it('drops a model whose override is not a reference', () => {
    const nodes: unknown[] = [
      mesh('a'),
      { ...modelNodeFixture('m'), model: { assetId: 'x', textures: { map: 'tex-1' } } },
    ]

    expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a'])
  })

  it('keeps a model pointing at an asset nothing answers to, which is a project that moved', () => {
    const ghost = modelNodeFixture('m', 'gone')
    expect(reread({ ...EMPTY_SCENE, nodes: [ghost], selectedIds: [] }).nodes).toEqual([ghost])
  })

  /**
   * The costliest failure of the whole rig work, because it is invisible: a document saved before
   * clips were plural opening with nothing playing looks exactly like one that never played.
   */
  describe('a model saved before clips were plural', () => {
    const legacy = (animation: unknown): unknown => ({
      ...modelNodeFixture('m'),
      model: { assetId: 'a', animation },
    })

    const clipsOf = (animation: unknown) => {
      const node = sceneFromPayload({ nodes: [legacy(animation)] }).nodes[0]
      return node?.type === 'model' ? node.model.clips : undefined
    }

    it('opens with its clip turned into a block that plays the same', () => {
      const clips = clipsOf({
        clip: 'Walk',
        playing: true,
        time: 0.5,
        speed: 2,
        loop: false,
        start: 3,
      })

      expect(clips).toEqual([
        {
          id: 'legacy',
          source: { kind: 'embedded', name: 'Walk' },
          label: 'Walk',
          start: 3,
          duration: 0,
          offset: 0.5,
          speed: 2,
          loop: false,
          fadeIn: 0,
          fadeOut: 0,
          rootMotion: 'auto',
        },
      ])
    })

    // `start` came after the rest of `AnimationRef`, and the reader never required it.
    it('opens one written before a clip could be moved along the band', () => {
      const clips = clipsOf({ clip: 'Walk', playing: false, time: 0, speed: 1, loop: true })

      expect(clips?.[0]?.start).toBe(0)
    })

    it('never writes the singular form back', () => {
      const node = sceneFromPayload({
        nodes: [legacy({ clip: 'Walk', playing: false, time: 0, speed: 1, loop: true, start: 0 })],
      }).nodes[0]

      expect(node?.type === 'model' && 'animation' in node.model).toBe(false)
    })

    it('leaves a model that never animated without any clip at all', () => {
      expect(clipsOf(undefined)).toBeUndefined()
    })

    /** A block as a file spells one. */
    const clip = {
      id: 'c1',
      source: { kind: 'embedded', name: 'Run' },
      label: 'Run',
      start: 0,
      duration: 0,
      offset: 0,
      speed: 1,
      loop: true,
      fadeIn: 0,
      fadeOut: 0,
      rootMotion: 'auto',
    }

    // Written for two days, then moved to `sceneViews`. A file that still spells it must open —
    // the alternative is a model vanishing from a scene saved last week.
    it('opens a block that still carries the play flag it used to hold', () => {
      const nodes: unknown[] = [
        { ...modelNodeFixture('m'), model: { assetId: 'a', clips: [{ ...clip, playing: true }] } },
      ]
      const node = sceneFromPayload({ nodes }).nodes[0]

      expect(node?.type === 'model' && node.model.clips?.[0]?.source.name).toBe('Run')
    })

    it('keeps the list when a file holds both forms, and drops the leftover', () => {
      const nodes: unknown[] = [
        {
          ...modelNodeFixture('m'),
          model: {
            assetId: 'a',
            clips: [clip],
            animation: { clip: 'Walk', playing: false, time: 0, speed: 1, loop: true, start: 0 },
          },
        },
      ]
      const node = sceneFromPayload({ nodes }).nodes[0]

      expect(node?.type === 'model' && node.model.clips).toEqual([clip])
      expect(node?.type === 'model' && 'animation' in node.model).toBe(false)
    })

    it('drops a model whose clip list is malformed, like any other bad field', () => {
      const nodes: unknown[] = [
        mesh('a'),
        { ...modelNodeFixture('m'), model: { assetId: 'x', clips: [{ id: 'c1' }] } },
      ]

      expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a'])
    })

    it('drops a model whose rig breaks an invariant of its own', () => {
      const nodes: unknown[] = [
        mesh('a'),
        {
          ...modelNodeFixture('m'),
          model: {
            assetId: 'x',
            rig: {
              origin: 'local',
              bones: [{ name: 'Spine', parent: 'Hips', rest: IDENTITY_TRANSFORM }],
            },
          },
        },
      ]

      expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a'])
    })

    it('carries a rig through a round trip', () => {
      const rest = { ...IDENTITY_TRANSFORM, position: { x: 0, y: 1, z: 0 } }
      const model = modelNodeFixture('m')
      model.model = {
        ...model.model,
        rig: { origin: 'local', bones: [{ name: 'Hips', parent: null, rest, role: 'Hips' }] },
      }

      expect(reread({ ...EMPTY_SCENE, nodes: [model], selectedIds: [] }).nodes).toEqual([model])
    })
  })

  // A document names no environment until this step: every one written so far, and any file a
  // hand left half-edited, has to open lit rather than black.
  it('lights a scene the file says nothing about with the studio', () => {
    expect(sceneFromPayload({ nodes: [] }).environment).toEqual({ kind: 'studio' })
    expect(sceneFromPayload({ nodes: [], environment: null }).environment).toEqual({
      kind: 'studio',
    })
    expect(sceneFromPayload({ nodes: [], environment: { kind: 'skybox' } }).environment).toEqual({
      kind: 'studio',
    })
  })

  it('carries a chosen sky through a round trip', () => {
    const lit: SceneState = { ...EMPTY_SCENE, environment: { kind: 'skybox', assetId: 'sky-1' } }
    expect(reread(lit).environment).toEqual({ kind: 'skybox', assetId: 'sky-1' })
  })

  // Saving a grouped scene and reopening it dropped every group, leaving their children hanging
  // from a parent nothing answered to — invisible in the outliner, and kept in the file.
  it('carries a group and what hangs from it through a round trip', () => {
    const group = groupNode()
    const child = { ...mesh('a'), parentId: group.id }

    const back = reread({ ...EMPTY_SCENE, nodes: [group, child] }).nodes
    expect(back.map(node => node.id)).toEqual([group.id, 'a'])
    expect(back[1]?.parentId).toBe(group.id)
  })

  // Same trap as the group's: a node type the loader has never heard of is dropped, and a scene
  // saved with sprites would reopen without them.
  it('carries a sprite and the picture it wears through a round trip', () => {
    const back = reread({ ...EMPTY_SCENE, nodes: [spriteNodeFixture('s1', 'pic-1')] }).nodes

    expect(back[0]).toMatchObject({
      type: 'sprite',
      sprite: { map: { assetId: 'pic-1' }, opacity: 1, color: null },
    })
  })

  /**
   * The trap this scene has fallen into twice: `isSceneNode` did not know `group`, and a grouped
   * scene reopened without its groups; the same was waiting for `sprite`. Every new kind of node
   * is tested by a round trip through what a file holds, never by reading the guard.
   */
  it('carries a text, its face and its shape through a round trip', () => {
    const written = textNodeFixture('t1', { value: 'Bonjour', size: 2, depth: 0.5 })

    const back = reread({ ...EMPTY_SCENE, nodes: [written] }).nodes

    expect(back).toHaveLength(1)
    expect(back[0]).toMatchObject({
      type: 'text',
      text: { value: 'Bonjour', size: 2, depth: 0.5, font: { source: 'embedded', family: 'Lato' } },
    })
  })

  // Every new kind of node is tested by a round trip through what a file holds — the trap this
  // loader has fallen into twice, for groups and then for sprites.
  it('carries a rail, its points and its shape through a round trip', () => {
    const rail = pathNodeFixture('rail')

    expect(reread({ ...EMPTY_SCENE, nodes: [rail] }).nodes).toEqual([rail])
  })

  it('drops a rail of fewer than two points, and keeps the scene around it', () => {
    const rail = pathNodeFixture('rail')
    const nodes: unknown[] = [
      mesh('a'),
      { ...rail, path: { ...rail.path, points: [{ x: 0, y: 0, z: 0 }] } },
      { ...rail, id: 'nowhere', path: { ...rail.path, points: 'somewhere' } },
    ]

    expect(sceneFromPayload({ nodes }).nodes.map(node => node.id)).toEqual(['a'])
  })

  // A family this machine has not got is kept as written: the document said what it meant, and
  // rewriting it here would lose the author's choice on every open.
  it('keeps a system face nobody here has, rather than rewriting the document', () => {
    const written = textNodeFixture('t1', { font: { source: 'system', family: 'Futura' } })

    const back = reread({ ...EMPTY_SCENE, nodes: [written] }).nodes

    expect(back[0]?.type === 'text' && back[0].text.font).toEqual({
      source: 'system',
      family: 'Futura',
    })
  })

  // A face the studio no longer ships is one nothing can produce: fallen back rather than kept,
  // so the words still draw.
  it('falls back to a shipped face when the document names one it no longer has', () => {
    const written = textNodeFixture('t1', { font: { source: 'embedded', family: 'Helvetiker' } })

    const back = reread({ ...EMPTY_SCENE, nodes: [written] }).nodes

    expect(back[0]?.type === 'text' && back[0].text.font.family).toBe('Lato')
  })

  it.each([
    ['a size that is not a number', { ...DEFAULT_TEXT, size: 'big' }],
    ['no words at all', { ...DEFAULT_TEXT, value: 42 }],
    ['a text that is not an object', 'Bonjour'],
  ])('drops a text with %s', (_case, text) => {
    const nodes: unknown[] = [{ ...textNodeFixture('t1'), text }]

    expect(sceneFromPayload({ nodes }).nodes).toHaveLength(0)
  })

  /**
   * Driven off the table rather than named one by one: `isSprite` was the last guard checking its
   * fields by hand, so a field added to `SPRITE_SPECS` went unverified at load — and a document
   * carrying a wrong value for it reopened with that value in place.
   */
  // The colour apart: `null` is legal for it and for nothing else, and a case below covers it.
  const measured = Object.keys(SPRITE_SPECS).filter(name => name !== 'color')

  it.each(measured)('drops a sprite whose %s is not a number', field => {
    const broken = {
      ...spriteNodeFixture('s1'),
      sprite: { color: null, opacity: 1, map: null, [field]: 'half' },
    }

    expect(sceneFromPayload({ nodes: [broken] }).nodes).toEqual([])
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
    // 'camera' used to stand for an unknown type here; it is a node of its own since renders
    // need one, so the example moved to something the studio still draws nothing for.
    ['a type nothing renders', nodeWith({ type: 'projector' })],
    ['a geometry of an unknown kind', nodeWith({ geometry: { kind: 'blob', radius: 1 } })],
    ['a geometry missing a parameter', nodeWith({ geometry: { kind: 'box', width: 1 } })],
    ['a geometry whose parameter is text', nodeWith({ geometry: { kind: 'sphere', radius: '1' } })],
    [
      'a material of an unknown kind',
      nodeWith({ material: { ...DEFAULT_MATERIAL, kind: 'toon' } }),
    ],
    ['a texture without an asset', nodeWith({ material: { ...DEFAULT_MATERIAL, map: {} } })],
    ['an id that is not text', nodeWith({ id: 7 })],
    ['a transform that is not an object', nodeWith({ transform: 'origin' })],
    ['a geometry whose kind is not text', nodeWith({ geometry: { kind: 7 } })],
    ['a material that is not an object', nodeWith({ material: 'standard' })],
    [
      'a material colour that is not text',
      nodeWith({ material: { ...DEFAULT_MATERIAL, color: 7 } }),
    ],
    ['a model whose reference is not an object', { ...modelNodeFixture('m'), model: 'asset-1' }],
    ['a sprite that is not an object', { ...spriteNodeFixture('s'), sprite: 'red' }],
    [
      'a sprite colour that is not text',
      { ...spriteNodeFixture('s'), sprite: { color: 7, opacity: 1, map: null } },
    ],
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

  /**
   * The guarantee this used to get from a dropped node, now that an absent slot is legal: a slot
   * added to `MaterialDescriptor` and forgotten in `TEXTURE_SLOTS` would go unchecked, and the
   * texture it names would be neither validated nor drawn.
   */
  it('names every texture slot a dressed material has to carry', () => {
    const declared = Object.keys(DEFAULT_MATERIAL).filter(name => name.endsWith('Map'))

    expect([...TEXTURE_SLOTS].sort()).toEqual(['map', ...declared].sort())
  })

  /**
   * The defect this guards: the tables are exhaustive by typecheck, so a field added to one is
   * required of every document written before it existed — and a node that fails its guard is
   * dropped in silence, indistinguishable from a node that never was.
   */
  it('revives a material missing a slot rather than dropping the node', () => {
    const stripped: Record<string, unknown> = { ...DEFAULT_MATERIAL }
    delete stripped.normalMap

    const [node] = sceneFromPayload({ nodes: [nodeWith({ material: stripped })] }).nodes

    expect(node?.type === 'mesh' && node.material.normalMap).toBe(null)
  })

  it('revives a sprite missing a measured field with the default for it', () => {
    const stripped: Record<string, unknown> = { ...DEFAULT_SPRITE }
    delete stripped.opacity
    const nodes: unknown[] = [{ ...spriteNodeFixture('s1'), sprite: stripped }]

    const [node] = sceneFromPayload({ nodes }).nodes

    expect(node?.type === 'sprite' && node.sprite.opacity).toBe(DEFAULT_SPRITE.opacity)
  })

  it('revives a text missing a measured field with the default for it', () => {
    const stripped: Record<string, unknown> = { ...DEFAULT_TEXT }
    delete stripped.curveSegments
    const nodes: unknown[] = [{ ...textNodeFixture('t1'), text: stripped }]

    const [node] = sceneFromPayload({ nodes }).nodes

    expect(node?.type === 'text' && node.text.curveSegments).toBe(DEFAULT_TEXT.curveSegments)
  })

  // Absent is a file that says nothing; `null` is a file that says something wrong.
  it('still drops a node whose measured field is null rather than absent', () => {
    const nodes: unknown[] = [
      { ...spriteNodeFixture('s1'), sprite: { ...DEFAULT_SPRITE, opacity: null } },
    ]

    expect(sceneFromPayload({ nodes }).nodes).toEqual([])
  })
})

describe('the timeline a file holds', () => {
  const trackPayload = {
    id: 'track-1',
    name: 'Cube position',
    index: 0,
    muted: false,
    solo: false,
    locked: false,
    target: { nodeId: 'cube', property: 'position' },
    keys: [{ time: 1, value: { x: 1, y: 0, z: 0 } }],
  }

  const read = (animation: unknown) =>
    sceneFromPayload({ nodes: [], environment: { kind: 'studio' }, animation }).animation

  it('opens on an empty one where the file says nothing — every document written so far', () => {
    expect(read(undefined)).toEqual(EMPTY_TIMELINE)
  })

  it('reads a track back whole, keys included', () => {
    const timeline = read({ duration: 8, fps: 30, tracks: [trackPayload] })

    expect(timeline).toMatchObject({ duration: 8, fps: 30 })
    expect(timeline.tracks[0]?.keys).toEqual(trackPayload.keys)
  })

  it('drops one malformed track rather than the animation around it', () => {
    const timeline = read({
      tracks: [trackPayload, { id: 'broken', name: 'Broken' }, { ...trackPayload, id: 'track-2' }],
    })

    expect(timeline.tracks.map(track => track.id)).toEqual(['track-1', 'track-2'])
  })

  it('refuses a track whose property is not one this version drives', () => {
    const timeline = read({
      tracks: [{ ...trackPayload, target: { nodeId: 'cube', property: 'colour' } }],
    })

    expect(timeline.tracks).toEqual([])
  })

  it('refuses a key that is not a point in time and space', () => {
    const timeline = read({ tracks: [{ ...trackPayload, keys: [{ time: 'soon' }] }] })
    expect(timeline.tracks).toEqual([])
  })

  it('falls back on the defaults for a length or a rate that says nothing usable', () => {
    const timeline = read({ duration: -3, fps: 0, tracks: [] })
    expect(timeline).toMatchObject({
      duration: EMPTY_TIMELINE.duration,
      fps: EMPTY_TIMELINE.fps,
    })
  })

  it('takes a bone track, which names a bone inside a file rather than a node', () => {
    const timeline = read({
      tracks: [
        { ...trackPayload, target: { nodeId: 'perso', bone: 'spine', property: 'rotation' } },
      ],
    })

    expect(timeline.tracks[0]?.target).toMatchObject({ bone: 'spine' })
  })

  it('reads the shots back whole, and gives none to a file written before they existed', () => {
    const shot = { id: 'shot-1', cameraId: 'cam-a', layer: 2, start: 0, duration: 5 }

    expect(read({ tracks: [], shots: [shot] }).shots).toEqual([shot])
    expect(read({ tracks: [trackPayload] }).shots).toEqual([])
  })

  // A shot of no length covers no instant, so it can only ever be a hole in the band.
  it('drops a shot of no length, and one naming no camera, rather than the band around it', () => {
    const shot = { id: 'shot-1', cameraId: 'cam-a', layer: 0, start: 0, duration: 5 }
    const timeline = read({
      tracks: [],
      shots: [
        { ...shot, id: 'empty', duration: 0 },
        { ...shot, id: 'nameless', cameraId: '' },
        shot,
      ],
    })

    expect(timeline.shots.map(kept => kept.id)).toEqual(['shot-1'])
  })

  it('refuses a bone that is not a name', () => {
    const timeline = read({
      tracks: [{ ...trackPayload, target: { nodeId: 'perso', bone: 7, property: 'rotation' } }],
    })

    expect(timeline.tracks).toEqual([])
  })
})
