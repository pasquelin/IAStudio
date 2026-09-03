import { retargetFitOf } from './retarget'
import {
  AnimationClip,
  Bone,
  Group,
  Mesh,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
  VectorKeyframeTrack,
} from 'three'
import type { Object3D } from 'three'
import { BONE_SHAPES } from './boneShapes'
import { describe, expect, it, vi } from 'vitest'
import { assetClip, bundledClip, clipLane, embeddedClip, type ClipRef } from '@shared/domain/scene'
import { bundledAnimationUrl } from '@shared/domain/animationLibrary'
import { assetUrl } from '@shared/domain/asset'
import { skeletonSignatureOf, type SkeletonProfile } from '@shared/domain/skeletonProfile'
import { SceneRenderer } from './SceneRenderer'
import type { BvhBuilder } from './bvhBuilder'
import type { Retarget } from './retarget'
import type * as ModelCache from './modelCache'
import { animationTrack, cameraShot } from './animation-fixtures'
import { STUDIO_METADATA_KEY } from '@shared/domain/studioMetadata'
import { cameraNodeFixture, meshNode, modelNodeFixture, pathNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE, IDENTITY_TRANSFORM, type SceneNode, type SceneState } from './sceneState'
import {
  EMPTY_TIMELINE,
  type AnimationTimeline,
  type AnimationTrack,
  type CameraShot,
  type Keyframe,
} from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'

/**
 * The instance the scene mounts is a clone, which nothing outside the engine can reach. Handing
 * the source back in its place is what makes the mixer's work observable — and it is the source's
 * clips that drive it either way, since `Object3D.copy` carries none.
 */
vi.mock('./modelCache', async importOriginal => ({
  ...(await importOriginal<typeof ModelCache>()),
  instanceOf: (source: Object3D) => source,
}))

/** A cube travelling one unit along X over one second. */
const walk = (name = 'walk'): AnimationClip =>
  new AnimationClip(name, 1, [new VectorKeyframeTrack('cube.position', [0, 1], [0, 0, 0, 1, 0, 0])])

function animatedModel(clips: AnimationClip[]): Group {
  const root = new Group()
  const cube = new Mesh(new SphereGeometry(1, 4, 4))
  cube.name = 'cube'
  root.add(cube)
  root.animations = clips
  return root
}

/** The same, carrying a skeleton — which is where a role is read from now, never a document. */
function riggedModel(clips: AnimationClip[], roles?: Record<string, string>): Group {
  const root = animatedModel(clips)
  const hips = new Bone()
  hips.name = 'b0'
  hips.position.set(0, 1, 0)
  const spine = new Bone()
  spine.name = 'b1'
  hips.add(spine)
  root.add(hips)
  if (roles) root.userData = { iastudio: { roles } }

  return root
}

const cubeOf = (root: Group): Object3D => {
  const cube = root.getObjectByName('cube')
  if (!cube) throw new Error('the fixture builds one named child')
  return cube
}

/** No worker under vitest, and no tree is what this file is about. */
const bvh: BvhBuilder = { accelerate: () => Promise.resolve(), dispose: () => {} }

function withModel(loaded: Group): SceneRenderer {
  return new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    loadModel: () => Promise.resolve(loaded),
    bvh,
  })
}

const modelNode = (clip: ClipRef | null) => ({
  ...modelNodeFixture('a'),
  model: { assetId: 'asset-1', ...(clip && { lanes: [clipLane('main', [clip])] }) },
})

/** A block on `walk`, since that is the clip every fixture of this file brings. */
const walkBlock = (extra: Partial<ClipRef> = {}): ClipRef => embeddedClip('block-1', 'walk', extra)

describe('SceneRenderer and the clips a model brought', () => {
  it('poses the model where the document says, without waiting for a frame', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0.5 }))],
    })

    // The file lands a tick after the sync that built its holder; the pose lands with it.
    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))
    engine.dispose()
  })

  it('leaves a model at rest when the document names no clip', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    expect(cubeOf(loaded).position.x).toBe(0)
    engine.dispose()
  })

  it('follows the document when the head is moved on a model already on stage', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0 }))],
    })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0.25 }))],
    })

    expect(cubeOf(loaded).position.x).toBeCloseTo(0.25, 5)
    engine.dispose()
  })

  /**
   * A held preview has no loop of its own to write the pose again, and applying the document
   * poses the model from the scene's head: editing the speed of the very block being looked at
   * would otherwise snap the character back to where the band stands.
   */
  it('keeps a pose the preview is held at when the document is applied again', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(walkBlock({ offset: 0 }))] })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())

    engine.setPreview({ nodeId: 'a', clipId: 'block-1', at: 0.4, playing: false })
    expect(cubeOf(loaded).position.x).toBeCloseTo(0.4, 5)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(walkBlock({ offset: 0, speed: 2 }))] })

    expect(cubeOf(loaded).position.x).toBeCloseTo(0.8, 5)
    engine.dispose()
  })

  it('gives the model back to the head once the preview is dropped', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(walkBlock({ offset: 0 }))] })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    engine.setPreview({ nodeId: 'a', clipId: 'block-1', at: 0.4, playing: false })

    engine.setPreview(null)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(walkBlock({ offset: 0 }))] })

    expect(cubeOf(loaded).position.x).toBeCloseTo(0, 5)
    engine.dispose()
  })

  it('takes a model with no clip at all without complaining', async () => {
    const loaded = animatedModel([])
    const engine = withModel(loaded)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    engine.dispose()
  })

  it('lets go of the mixer when the node goes, so a released model keeps no bones alive', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock({ offset: 0.5 }))],
    })
    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))

    engine.apply(EMPTY_SCENE)

    // With no action left driving it, three puts back the value the file was loaded with.
    expect(cubeOf(loaded).position.x).toBe(0)
    engine.dispose()
  })
})

describe('SceneRenderer and the bones a rig carries', () => {
  const rigged = (): Group => {
    const root = animatedModel([walk()])
    const bone = new Bone()
    bone.name = 'spine'
    root.add(bone)
    return root
  }

  /**
   * The helpers hang beside the nodes, so the scene is where they are counted — reached by
   * walking up from the mounted model rather than into the engine: holder, then scene.
   */
  const bonesAround = (loaded: Group): Object3D[] =>
    (loaded.parent?.parent?.children ?? []).filter(child => child.name === BONE_SHAPES)

  it('draws no bones for a model that carries none', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    expect(bonesAround(loaded)).toHaveLength(0)
    engine.dispose()
  })

  // The solids and not three's `SkeletonHelper`: its lines showed through them, and a skeleton
  // read as half wireframe — measured on screen. The helper is kept, never hung in the scene.
  it('hangs the bones beside the nodes for a rigged model, hidden until asked for', async () => {
    const loaded = rigged()
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(bonesAround(loaded)).toHaveLength(1))
    expect(bonesAround(loaded)[0]?.visible).toBe(false)
    expect(
      (loaded.parent?.parent?.children ?? []).filter(child => child.type === 'SkeletonHelper'),
    ).toHaveLength(0)

    engine.setSkeletons(true)
    expect(bonesAround(loaded)[0]?.visible).toBe(true)
    engine.dispose()
  })

  // What POSING is, as opposed to editing the rest: the bone moves and its skin follows, so
  // nothing of the file's own skeleton is touched.
  it('poses one bone where a hand asked', async () => {
    const loaded = riggedModel([walk()])
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())

    engine.poseBone('a', 'b1', { ...IDENTITY_TRANSFORM, position: { x: 0, y: 0.5, z: 0 } })

    expect(loaded.getObjectByName('b1')?.position.y).toBeCloseTo(0.5, 5)
    engine.dispose()
  })

  /**
   * A sword in a hand: the node still hangs from the CHARACTER, and the socket says which of its
   * bones to follow. Hung from the model itself, it stood still while the arm swung.
   */
  it('hangs a node attached to a socket on the bone that socket names', async () => {
    const loaded = riggedModel([walk()])
    loaded.userData = {
      [STUDIO_METADATA_KEY]: {
        character: {
          sockets: [{ id: 'hand', name: 'Main', bone: 'b1', rest: IDENTITY_TRANSFORM }],
        },
      },
    }
    const engine = withModel(loaded)
    const sword = { ...meshNode('sword'), parentId: 'a', attach: { socket: 'hand' } }

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null), sword] })
    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null), sword] })

    await vi.waitFor(() =>
      expect(loaded.getObjectByName('b1')?.children.map(child => child.name)).toContain('sword'),
    )
    engine.dispose()
  })

  it('takes the bones away with the node they belonged to', async () => {
    const loaded = rigged()
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })
    await vi.waitFor(() => expect(bonesAround(loaded)).toHaveLength(1))

    // Kept before the node goes: the model is unparented with it, and the walk up would end early.
    const scene = loaded.parent?.parent
    engine.apply(EMPTY_SCENE)

    expect((scene?.children ?? []).filter(child => child.name === BONE_SHAPES)).toHaveLength(0)
    engine.dispose()
  })
})

describe('SceneRenderer and the timeline over the scene', () => {
  const cube = meshNode('cube-1')

  const timelineWith = (value: number): AnimationTimeline => ({
    ...EMPTY_TIMELINE,
    tracks: [
      {
        id: 'track-1',
        name: 'Cube position',
        index: 0,
        muted: false,
        solo: false,
        locked: false,
        target: { nodeId: 'cube-1', property: 'position' },
        keys: [{ time: 0, value: { x: value, y: 0, z: 0 } }],
      },
    ],
  })

  /** The engine names its objects after their node, which is how one is found from outside. */
  const objectOf = (engine: SceneRenderer, id: string): Object3D | undefined => {
    const scene: { children: Object3D[] } = Reflect.get(engine, 'viewport').scene
    return scene.children.find(child => child.name === id)
  }

  it('lays what the tracks add over the pose the node holds', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply({ ...EMPTY_SCENE, nodes: [cube], animation: timelineWith(4) })

    expect(objectOf(engine, 'cube-1')?.position.x).toBe(4)
    engine.dispose()
  })

  it('follows the head without the document changing at all', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const one = timelineWith(0).tracks[0]
    if (!one) throw new Error('the fixture builds one track')

    const timeline: AnimationTimeline = {
      ...EMPTY_TIMELINE,
      tracks: [
        {
          ...one,
          keys: [
            { time: 0, value: { x: 0, y: 0, z: 0 } },
            { time: 2, value: { x: 10, y: 0, z: 0 } },
          ],
        },
      ],
    }
    engine.apply({ ...EMPTY_SCENE, nodes: [cube], animation: timeline })
    expect(objectOf(engine, 'cube-1')?.position.x).toBe(0)

    engine.setPlayhead(1)
    expect(objectOf(engine, 'cube-1')?.position.x).toBeCloseTo(5, 5)
    engine.dispose()
  })

  it('leaves a scene with no track exactly where its nodes stand', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply({ ...EMPTY_SCENE, nodes: [cube] })
    engine.setPlayhead(3)

    expect(objectOf(engine, 'cube-1')?.position.x).toBe(0)
    engine.dispose()
  })
})

describe('SceneRenderer and a camera on a rail', () => {
  const objectOf = (engine: SceneRenderer, id: string): Object3D | undefined => {
    const scene: { children: Object3D[] } = Reflect.get(engine, 'viewport').scene
    return scene.children.find(child => child.name === id)
  }

  const channel = (
    id: string,
    target: AnimationTrack['target'],
    keys: Keyframe[],
    muted = false,
  ): AnimationTrack => animationTrack(id, target.property, keys, { target, muted })

  /** A rail ten units long down X, a camera bound to it for the whole of a four-second shot. */
  const stagedScene = (
    extra: Partial<CameraShot> = {},
    timeline: Partial<AnimationTimeline> = {},
  ): SceneState => ({
    ...EMPTY_SCENE,
    nodes: [
      cameraNodeFixture('cam'),
      pathNodeFixture('rail', {
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 10, y: 0, z: 0 },
        ],
      }),
      {
        ...meshNode('watched'),
        transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 0, z: -20 } },
      },
    ],
    animation: {
      ...EMPTY_TIMELINE,
      ...timeline,
      shots: [
        cameraShot('s1', {
          cameraId: 'cam',
          start: 0,
          duration: 4 * SECOND,
          motion: { pathId: 'rail', easing: 'linear', from: 0, to: 1 },
          ...extra,
        }),
      ],
    },
  })

  const stagedOn = (scene: SceneState): SceneRenderer => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply(scene)
    return engine
  }

  const staged = (
    extra: Partial<CameraShot> = {},
    timeline: Partial<AnimationTimeline> = {},
  ): SceneRenderer => stagedOn(stagedScene(extra, timeline))

  it('stands the camera at the start of the rail, and at its end when the shot is over', () => {
    const engine = staged()

    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(0, 4)

    // One microsecond before the end: a shot covers `[start, start + duration)`, so the very
    // instant it ends is already outside it — see `activeShotAt`.
    engine.setPlayhead(4 * SECOND - 1)
    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(10, 4)
    engine.dispose()
  })

  it('reuses unchanged shadow maps while a camera travels on a rail', () => {
    const engine = staged()
    const redraw = vi.spyOn(engine['viewport'], 'requestRender')
    const refresh = vi.spyOn(engine['viewport'], 'requestCameraRender')

    engine.setPlayhead(SECOND)

    expect(redraw).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledOnce()
    engine.dispose()
  })

  it('refreshes shadow maps when a camera shot carries a shadow caster', () => {
    const scene = stagedScene()
    const engine = stagedOn({ ...scene, nodes: [...scene.nodes, meshNode('carried', 'cam')] })
    const redraw = vi.spyOn(engine['viewport'], 'requestRender')

    engine.setPlayhead(SECOND)

    expect(redraw).toHaveBeenCalledOnce()
    engine.dispose()
  })

  /**
   * Placing the head straight there must give the very same STATE as walking to it — where the
   * camera stands, where it aims and what its lens reads, the three at once. That is the whole
   * reason nothing here accumulates frame by frame, and the aim is the one that would drift:
   * it is taken from a target that is itself animated.
   */
  it('gives the same camera state whether the head arrived in one step or in twenty', () => {
    const drifting = (): SceneRenderer =>
      staged(
        { target: { kind: 'node', nodeId: 'watched' } },
        {
          tracks: [
            channel('lens', { nodeId: 'cam', property: 'fov' }, [
              { time: 0, value: { x: 0, y: 0, z: 0 } },
              { time: 4 * SECOND, value: { x: 20, y: 0, z: 0 } },
            ]),
            channel('walk', { nodeId: 'watched', property: 'position' }, [
              { time: 0, value: { x: 0, y: 0, z: 0 } },
              { time: 4 * SECOND, value: { x: 30, y: 5, z: 0 } },
            ]),
          ],
        },
      )

    const stateOf = (engine: SceneRenderer): number[] => {
      const camera = objectOf(engine, 'cam')
      if (!(camera instanceof PerspectiveCamera)) throw new Error('the fixture stages a camera')
      return [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov]
    }

    const straight = drifting()
    straight.setPlayhead(2.5 * SECOND)
    const once = stateOf(straight)

    // What the head reads there, spelled out: without this the comparison below would hold just
    // as well on a camera that never left its rest, which is the one way it could mean nothing.
    expect(once[0]).toBeCloseTo(6.25, 4)
    expect(once.at(-1)).toBeCloseTo(62.5, 4)
    expect(Math.abs(once[4] ?? 0)).toBeGreaterThan(0.1)

    const walked = drifting()
    for (let step = 1; step <= 20; step += 1) walked.setPlayhead((2.5 * SECOND * step) / 20)

    // Compared WHOLE rather than index by index: a state one number shorter would otherwise pass.
    expect(stateOf(walked)).toEqual(once.map(value => expect.closeTo(value, 10)))
    straight.dispose()
    walked.dispose()
  })

  it('turns the camera towards the node its shot watches', () => {
    const engine = staged({ target: { kind: 'node', nodeId: 'watched' } })
    const camera = objectOf(engine, 'cam')

    // The watched mesh stands down -Z, which is where a camera looks by default: aimed at it
    // from the start of the rail, the camera is barely turned at all.
    expect(camera?.quaternion.y ?? 1).toBeCloseTo(0, 2)

    // One microsecond before the end: a shot covers `[start, start + duration)`, so the very
    // instant it ends is already outside it — see `activeShotAt`.
    engine.setPlayhead(4 * SECOND - 1)
    // From the far end of the rail it has to turn to keep the same mesh in frame.
    expect(Math.abs(objectOf(engine, 'cam')?.quaternion.y ?? 0)).toBeGreaterThan(0.1)
    engine.dispose()
  })

  it('opens the lens by what its fov channel adds, and puts it back when that channel goes quiet', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const lensTrack = (muted: boolean): AnimationTimeline => ({
      ...EMPTY_TIMELINE,
      tracks: [
        channel(
          'lens',
          { nodeId: 'cam', property: 'fov' },
          [
            { time: 0, value: { x: 0, y: 0, z: 0 } },
            { time: 2 * SECOND, value: { x: 20, y: 0, z: 0 } },
          ],
          muted,
        ),
      ],
    })

    const nodes = [cameraNodeFixture('cam', { fov: 50 })]
    engine.apply({ ...EMPTY_SCENE, nodes, animation: lensTrack(false) })

    const lens = objectOf(engine, 'cam')
    expect(lens instanceof PerspectiveCamera && lens.fov).toBe(50)

    engine.setPlayhead(1 * SECOND)
    expect(lens instanceof PerspectiveCamera && lens.fov).toBeCloseTo(60, 5)

    // Muted, the lens takes back what the document says rather than keeping the last scrub.
    engine.apply({ ...EMPTY_SCENE, nodes, animation: lensTrack(true) })
    expect(lens instanceof PerspectiveCamera && lens.fov).toBe(50)
    engine.dispose()
  })

  // Scrubbing past the end of a shot used to strand the camera wherever its rail left it — and
  // the film went on being taken from there.
  it('puts the camera back where the document holds it once no shot drives it', () => {
    const engine = staged()

    engine.setPlayhead(4 * SECOND - 1)
    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(10, 4)

    engine.setPlayhead(5 * SECOND)
    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(0, 4)
    engine.dispose()
  })

  /**
   * Unbinding a rail, or deleting it, leaves the shot covering the head with nothing left to write
   * the camera's position — so it stayed where the rail had put it, on screen as in the film.
   */
  it('puts the camera back where the document holds it once its shot has no rail to run', () => {
    // The nodes travel by REFERENCE, as a command that writes only `animation` leaves them:
    // rebuilding them here would have `syncNode` write every transform again and hide the defect.
    const scene = stagedScene()

    const unbound = stagedOn(scene)
    unbound.setPlayhead(2 * SECOND)
    expect(objectOf(unbound, 'cam')?.position.x).toBeCloseTo(5, 4)
    unbound.apply({
      ...scene,
      animation: {
        ...scene.animation,
        shots: scene.animation.shots.map(shot => ({ ...shot, motion: undefined })),
      },
    })
    expect(objectOf(unbound, 'cam')?.position.x).toBeCloseTo(0, 4)
    unbound.dispose()

    const deleted = stagedOn(scene)
    deleted.setPlayhead(2 * SECOND)
    deleted.apply({ ...scene, nodes: scene.nodes.filter(node => node.type !== 'path') })
    expect(objectOf(deleted, 'cam')?.position.x).toBeCloseTo(0, 4)
    deleted.dispose()
  })

  /**
   * A camera may watch another that is itself riding a rail, and the watcher's line can outrank
   * the rider's — so every rail runs before any aim, rather than one camera at a time.
   */
  it('aims at where the camera it watches stands ON its rail, not where the document holds it', () => {
    const engine = stagedOn({
      ...EMPTY_SCENE,
      nodes: [
        {
          ...cameraNodeFixture('watcher'),
          transform: { ...IDENTITY_TRANSFORM, position: { x: 0, y: 0, z: 10 } },
        },
        cameraNodeFixture('rider'),
        pathNodeFixture('rail', {
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
          ],
        }),
      ],
      animation: {
        ...EMPTY_TIMELINE,
        // The watcher FIRST, which is the order that puts its line above the rider's.
        shots: [
          cameraShot('watching', {
            cameraId: 'watcher',
            start: 0,
            duration: 4 * SECOND,
            target: { kind: 'node', nodeId: 'rider' },
          }),
          cameraShot('riding', {
            cameraId: 'rider',
            start: 0,
            duration: 4 * SECOND,
            motion: { pathId: 'rail', easing: 'linear', from: 0, to: 1 },
          }),
        ],
      },
    })

    engine.setPlayhead(2 * SECOND)
    const watcher = objectOf(engine, 'watcher')
    const rider = objectOf(engine, 'rider')
    if (!watcher || !rider) throw new Error('both cameras stand in the scene')

    expect(rider.position.x).toBeCloseTo(5, 4)
    const aim = new Vector3(0, 0, -1).applyQuaternion(watcher.quaternion)
    expect(aim.angleTo(rider.position.clone().sub(watcher.position))).toBeCloseTo(0, 4)
    engine.dispose()
  })

  /**
   * And when the SHOT itself goes — deleted, or the undo of one just opened. The camera leaves
   * the roll this pass walks, so nothing reached it at all and it stayed on its rail.
   */
  it('puts the camera back where the document holds it once no shot names it any more', () => {
    const scene = stagedScene()
    const engine = stagedOn(scene)
    engine.setPlayhead(2 * SECOND)
    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(5, 4)

    engine.apply({ ...scene, animation: { ...scene.animation, shots: [] } })
    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(0, 4)
    engine.dispose()
  })

  /**
   * A rail is a working aid like the grid: the preview and the film both draw through
   * `hideWorkshop`, and a line with a knob per point ran across every frame of both.
   */
  it('hides the rails for a pass that shows what a camera films', () => {
    const engine = staged()
    const rail = objectOf(engine, 'rail')
    // `hideWorkshop` is what both the inset pass and `renderFilm` take; reached here directly,
    // since neither of the two can run without a GL context.
    const restore: () => void = Reflect.get(engine, 'hideWorkshop').call(engine)

    expect(rail?.visible).toBe(false)
    restore()
    expect(rail?.visible).toBe(true)
    engine.dispose()
  })

  /**
   * The gizmo stands where the object stands, so a camera aimed at a selected node filled its
   * preview — and its film — with the arrows instead of the node. Stood in for: the real one
   * needs a GL canvas, and `hideWorkshop` asks it for nothing but its helper.
   */
  it('hides the transform gizmo for a pass that shows what a camera films', () => {
    const engine = staged()
    const helper = new Group()
    Reflect.set(engine, 'gizmo', { getHelper: () => helper })
    const restore: () => void = Reflect.get(engine, 'hideWorkshop').call(engine)

    expect(helper.visible).toBe(false)
    restore()
    expect(helper.visible).toBe(true)

    // Back to none before disposing: the stand-in answers `getHelper` and nothing else, and
    // teardown unsubscribes from the real one.
    Reflect.set(engine, 'gizmo', null)
    engine.dispose()
  })

  /**
   * A knob per control point on every rail of the scene is what buries a five-camera sequence,
   * and only a SELECTED rail hands its points to the gizmo anyway — see `pathPointAt`.
   */
  it('shows a rail its knobs only while it is the selected one', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const scene = {
      ...EMPTY_SCENE,
      nodes: [
        pathNodeFixture('rail', {
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
          ],
        }),
      ],
    }
    const knobs = (): boolean[] =>
      (objectOf(engine, 'rail')?.children ?? [])
        .filter(child => child.name.startsWith('path-knob-'))
        .map(knob => knob.visible)

    engine.apply(scene)
    expect(knobs()).toEqual([false, false])

    engine.apply({ ...scene, selectedIds: ['rail'] })
    expect(knobs()).toEqual([true, true])
    engine.dispose()
  })

  /**
   * What ties a rail to its camera on screen: the line does start at the camera and follow its
   * axis, but unmarked it reads as somebody else's.
   */
  it('shows a rail its knobs when the camera riding it is the one selected', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const scene = {
      ...EMPTY_SCENE,
      nodes: [
        cameraNodeFixture('cam-a'),
        pathNodeFixture('rail', {
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
          ],
        }),
      ],
      animation: {
        ...EMPTY_TIMELINE,
        shots: [
          cameraShot('shot-1', {
            motion: { pathId: 'rail', easing: 'linear', from: 0, to: 1 },
          }),
        ],
      },
    }
    const knobs = (): boolean[] =>
      (objectOf(engine, 'rail')?.children ?? [])
        .filter(child => child.name.startsWith('path-knob-'))
        .map(knob => knob.visible)

    engine.apply(scene)
    expect(knobs()).toEqual([false, false])

    engine.apply({ ...scene, selectedIds: ['cam-a'] })
    expect(knobs()).toEqual([true, true])
    engine.dispose()
  })

  it('leaves a camera with no shot exactly where its transform puts it', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply({ ...EMPTY_SCENE, nodes: [cameraNodeFixture('cam')] })
    engine.setPlayhead(3 * SECOND)

    expect(objectOf(engine, 'cam')?.position.x).toBe(0)
    engine.dispose()
  })
})

describe('SceneRenderer shadow maps during playback', () => {
  it('reuses unchanged shadow maps when only a camera moves', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const track = animationTrack(
      'camera-position',
      'position',
      [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 1, y: 0, z: 0 } },
      ],
      { target: { nodeId: 'camera-1', property: 'position' } },
    )
    engine.apply({
      ...EMPTY_SCENE,
      nodes: [cameraNodeFixture('camera-1'), meshNode('cube-1')],
      animation: { ...EMPTY_TIMELINE, tracks: [track] },
    })
    const redraw = vi.spyOn(engine['viewport'], 'requestRender')
    const refresh = vi.spyOn(engine['viewport'], 'requestCameraRender')

    engine.setPlayhead(SECOND / 2)

    expect(redraw).not.toHaveBeenCalled()
    expect(refresh).toHaveBeenCalledOnce()
    engine.dispose()
  })

  it('refreshes shadow maps when an animated mesh moves', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const track = animationTrack(
      'mesh-position',
      'position',
      [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 1, y: 0, z: 0 } },
      ],
      { target: { nodeId: 'cube-1', property: 'position' } },
    )
    engine.apply({
      ...EMPTY_SCENE,
      nodes: [cameraNodeFixture('camera-1'), meshNode('cube-1')],
      animation: { ...EMPTY_TIMELINE, tracks: [track] },
    })
    const redraw = vi.spyOn(engine['viewport'], 'requestRender')

    engine.setPlayhead(SECOND / 2)

    expect(redraw).toHaveBeenCalledOnce()
    engine.dispose()
  })

  it('refreshes shadow maps when a camera carries a shadow caster', () => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    const track = animationTrack(
      'camera-position',
      'position',
      [
        { time: 0, value: { x: 0, y: 0, z: 0 } },
        { time: SECOND, value: { x: 1, y: 0, z: 0 } },
      ],
      { target: { nodeId: 'camera-1', property: 'position' } },
    )
    engine.apply({
      ...EMPTY_SCENE,
      nodes: [cameraNodeFixture('camera-1'), meshNode('cube-1', 'camera-1')],
      animation: { ...EMPTY_TIMELINE, tracks: [track] },
    })
    const redraw = vi.spyOn(engine['viewport'], 'requestRender')

    engine.setPlayhead(SECOND / 2)

    expect(redraw).toHaveBeenCalledOnce()
    engine.dispose()
  })

  it('refreshes shadow maps while a model clip can deform a caster', async () => {
    const loaded = animatedModel([walk()])
    const onClips = vi.fn()
    const engine = new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      onClips,
      loadModel: () => Promise.resolve(loaded),
      bvh,
    })
    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(walkBlock())],
    })
    await vi.waitFor(() => expect(onClips).toHaveBeenCalled())
    const redraw = vi.spyOn(engine['viewport'], 'requestRender')

    engine.setPlayhead(SECOND / 2)

    expect(redraw).toHaveBeenCalledOnce()
    engine.dispose()
  })
})

/**
 * Alt and shift over the viewport lays a point at the end of the rail being worked on, which is
 * how a trajectory is drawn click by click. `pointerNdcOf` is the one thing stood in for: it
 * reads a canvas the engine has none of under vitest, and everything downstream of it is real.
 */
describe('SceneRenderer and a rail drawn click by click', () => {
  const railScene = (extra: Partial<SceneState> = {}): SceneState => ({
    ...EMPTY_SCENE,
    nodes: [pathNodeFixture('rail')],
    selectedIds: ['rail'],
    ...extra,
  })

  /** An engine whose pointer lands dead centre of the view, having no canvas to read one off. */
  const aiming = (
    scene: SceneState,
    ndc: { x: number; y: number } | null = { x: 0, y: 0 },
  ): SceneRenderer => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply(scene)

    const viewport: { camera: PerspectiveCamera } = Reflect.get(engine, 'viewport')
    // What a frame does before any click can land. Left out, the view's matrix still holds the
    // placement it was BUILT with, and every ray leaves the origin looking down -Z.
    viewport.camera.updateMatrixWorld()
    Object.assign(viewport, { pointerNdcOf: () => ndc })
    return engine
  }

  /** Ends at DIFFERENT heights, so which end anchors the fallback plane is observable. */
  const SLOPED = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 3, z: -5 },
  ]

  const spotOf = (
    engine: SceneRenderer,
  ): { nodeId: string; point: { x: number; y: number; z: number } } | null =>
    Reflect.get(engine, 'railSpotAt').call(engine, new MouseEvent('pointerup'))

  /**
   * The height comes from the rail's LAST point, and the frame from the rail: a sloped rail a
   * hundred units out reads (3, 3, 3) of the world as (-97, 3, 3) of its own.
   */
  it('lays the point in the rail’s OWN frame, level with the end it is growing from', () => {
    const engine = aiming(
      railScene({
        nodes: [
          {
            ...pathNodeFixture('rail', { points: SLOPED }),
            transform: { ...IDENTITY_TRANSFORM, position: { x: 100, y: 0, z: 0 } },
          },
        ],
      }),
    )

    const spot = spotOf(engine)
    expect(spot?.nodeId).toBe('rail')
    expect(spot?.point.y).toBeCloseTo(3, 4)
    expect(spot?.point.x).toBeCloseTo(-97, 4)
    engine.dispose()
  })

  /**
   * The scenery wins over the fallback plane, which is what makes the gesture read as "I clicked
   * on that": a click on a crate lays the point ON the crate, not at the height of the last one.
   */
  it('lays the point on what the ray meets, above the level of the point before it', () => {
    const engine = aiming(railScene({ nodes: [pathNodeFixture('rail'), meshNode('crate')] }))

    // The unit cube of the fixture sits at the origin, and the view looks down at it from
    // (5, 5, 5) — so the ray meets its corner well above the y = 0 the rail's last point holds.
    expect(spotOf(engine)?.point.y).toBeCloseTo(0.5, 4)
    engine.dispose()
  })

  /**
   * Extending whichever rail came first would pose a point on one nobody aimed at, and a gesture
   * repeated ten times would scatter half of them. Neither too few nor too many will do.
   */
  it('answers nothing unless exactly ONE rail is being worked on', () => {
    const none = aiming(railScene({ selectedIds: [] }))
    expect(spotOf(none)).toBeNull()
    none.dispose()

    const both = aiming(
      railScene({
        nodes: [pathNodeFixture('rail'), pathNodeFixture('other')],
        selectedIds: ['rail', 'other'],
      }),
    )
    expect(spotOf(both)).toBeNull()
    both.dispose()
  })

  // Routine in a quad view: `pointerNdcOf` answers nothing for a pointer outside every pane.
  it('answers nothing for a pointer the viewport places nowhere', () => {
    const engine = aiming(railScene(), null)

    expect(spotOf(engine)).toBeNull()
    engine.dispose()
  })

  /**
   * The three things a ray walks past, and each reappears THROUGH a parent that passed: the
   * filter has to read the ancestors, not the roots handed to `intersectObjects`.
   */
  describe('and what the ray is not allowed to land on', () => {
    const LEVEL_SPOT = { x: 0, y: 0, z: 0 }

    const holder = (id: string): SceneNode => ({
      ...meshNode(id),
      castShadow: false,
      receiveShadow: false,
      type: 'group',
    })

    it('walks past a node the outliner has hidden, however solid it still is', () => {
      const crate = meshNode('crate')
      const engine = aiming(railScene({ nodes: [pathNodeFixture('rail'), crate] }))
      expect(spotOf(engine)?.point.y).toBeCloseTo(0.5, 4)

      engine.apply(railScene({ nodes: [pathNodeFixture('rail'), { ...crate, visible: false }] }))
      expect(spotOf(engine)?.point).toMatchObject(LEVEL_SPOT)
      engine.dispose()
    })

    /**
     * A camera sits ON the rail it rides, and selecting it is what makes that rail the one worked
     * on — so its body is squarely in the way of the very gesture that extends the rail.
     */
    it('walks past the body of a camera, which is a marker and not scenery', () => {
      const engine = aiming(
        railScene({
          nodes: [pathNodeFixture('rail'), { ...cameraNodeFixture('cam'), parentId: null }],
        }),
      )

      expect(spotOf(engine)?.point).toMatchObject(LEVEL_SPOT)
      engine.dispose()
    })

    /** A rail inside a group is reached through the group, and its knobs are 14 cm spheres. */
    it('walks past its own knobs when the rail hangs inside a group', () => {
      const engine = aiming(
        railScene({
          nodes: [
            holder('holder'),
            { ...pathNodeFixture('rail', { points: SLOPED }), parentId: 'holder' },
          ],
        }),
      )

      // The knob on the last point stands at y = 3, right where the fallback plane is: a hit on
      // its surface would read a radius above it.
      expect(spotOf(engine)?.point.y).toBeCloseTo(3, 4)
      engine.dispose()
    })
  })
})

describe('SceneRenderer and a track on one bone', () => {
  const boneTimeline = (value: number): AnimationTimeline => ({
    ...EMPTY_TIMELINE,
    tracks: [
      {
        id: 'track-bone',
        name: 'arm',
        index: 0,
        muted: false,
        solo: false,
        locked: false,
        target: { nodeId: 'a', bone: 'spine', property: 'position' },
        keys: [{ time: 0, value: { x: value, y: 0, z: 0 } }],
      },
    ],
  })

  it('moves the bone the track names, and leaves the model where it stands', async () => {
    const loaded = animatedModel([walk()])
    const bone = new Bone()
    bone.name = 'spine'
    loaded.add(bone)

    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)], animation: boneTimeline(3) })

    await vi.waitFor(() => expect(bone.position.x).toBe(3))
    // The model itself was never a target of that track.
    expect(loaded.parent?.position.x).toBe(0)
    engine.dispose()
  })

  it('lays the track over the pose the FILE gave the bone, not over zero', async () => {
    const loaded = animatedModel([walk()])
    const bone = new Bone()
    bone.name = 'spine'
    bone.position.set(10, 0, 0)
    loaded.add(bone)

    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)], animation: boneTimeline(3) })

    await vi.waitFor(() => expect(bone.position.x).toBe(13))
    engine.dispose()
  })
})

describe('SceneRenderer and the animations the app ships with', () => {
  /** What the retargeting port is asked, and what it hands back — here, the clips unchanged. */
  const straightThrough = (): Retarget & {
    asked: { target: Object3D; clips: string[] }[]
    learnt: SkeletonProfile[]
  } => {
    const asked: { target: Object3D; clips: string[] }[] = []
    const learnt: SkeletonProfile[] = []
    return {
      asked,
      learnt,
      adapt: (target, _source, clips) => {
        asked.push({ target, clips: clips.map(clip => clip.name) })
        return Promise.resolve([...clips])
      },
      // Read through the corrections a transfer would use — the double has none to apply.
      fitOf: (target, source) => retargetFitOf(target, source),
      remember: profile => void learnt.push(profile),
      dispose: () => {},
    }
  }

  function withShipped(
    loaded: Group,
    shipped: Group | Error,
    retarget: Retarget,
  ): { engine: SceneRenderer; asked: string[]; reported: ReturnType<typeof vi.fn> } {
    const asked: string[] = []
    const reported = vi.fn()
    const engine = new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      loadModel: () => Promise.resolve(loaded),
      loadAnimation: url => {
        asked.push(url)
        return shipped instanceof Error ? Promise.reject(shipped) : Promise.resolve(shipped)
      },
      onClips: reported,
      retarget,
      bvh,
    })
    return { engine, asked, reported }
  }

  const shippedBlock = (extra: Partial<ClipRef> = {}): ClipRef =>
    bundledClip('block-1', 'Capoeira', extra)

  // The whole point of the feature: a character brings no such clip, and the file that does was
  // authored for another skeleton entirely.
  it('reads the shipped file, replays it on the model, and plays the block', async () => {
    const loaded = animatedModel([])
    const retarget = straightThrough()
    const { engine, asked } = withShipped(loaded, animatedModel([walk('NlaTrack')]), retarget)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock({ offset: 0.5 }))] })

    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))
    expect(asked).toEqual([bundledAnimationUrl('Capoeira')])
    // The model's own instance, since that is the skeleton the clip has to speak to.
    expect(retarget.asked[0]?.target).toBe(loaded.parent)
    engine.dispose()
  })

  // `NlaTrack` is what Tripo spells and Uthana spells nothing at all: the studio names its blocks.
  it('never lets the name inside the file reach what the model plays', async () => {
    const loaded = animatedModel([])
    const retarget = straightThrough()
    const { engine, reported } = withShipped(loaded, animatedModel([walk('NlaTrack')]), retarget)

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock({ offset: 0.5 }))] })

    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeGreaterThan(0))
    // `NlaTrack` goes to the port, because that is what the file holds — and it reaches nothing
    // else: the block is filed under the FOLDER, and the model's own list stays empty.
    expect(retarget.asked[0]?.clips).toEqual(['NlaTrack'])
    expect(reported).toHaveBeenLastCalledWith('a', [], { 'bundled:Capoeira': 1 })
    engine.dispose()
  })

  // Loading is the expensive half — a shipped animation carries a whole character with it — and
  // every edit of a lane applies again.
  it('reads a shipped animation once, however often the lanes are applied', async () => {
    const loaded = animatedModel([])
    const { engine, asked } = withShipped(
      loaded,
      animatedModel([walk('NlaTrack')]),
      straightThrough(),
    )

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock())] })
    await vi.waitFor(() => expect(asked).toHaveLength(1))
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(bundledClip('block-2', 'Capoeira'))] })

    expect(asked).toEqual([bundledAnimationUrl('Capoeira')])
    engine.dispose()
  })

  /** Two characters on the same asset, each with its own block on the same shipped animation. */
  const twoDancers = (clip: ClipRef) => [
    { ...modelNode(clip), id: 'a' },
    { ...modelNode({ ...clip, id: 'block-2' }), id: 'b' },
  ]

  // Case 18 of the issue: the file itself is read once, not once per character.
  it('reads one animation file however many characters play it', async () => {
    const retarget = straightThrough()
    const { engine, asked } = withShipped(
      animatedModel([]),
      animatedModel([walk('NlaTrack')]),
      retarget,
    )

    engine.apply({ ...EMPTY_SCENE, nodes: twoDancers(shippedBlock()) })

    // Both characters were posed from it, and only one read paid for the two.
    await vi.waitFor(() => expect(retarget.asked).toHaveLength(2))
    expect(asked).toEqual([bundledAnimationUrl('Capoeira')])
    engine.dispose()
  })

  // Held while a block still names it, and no longer: what the second dancer saved is only worth
  // having if the file goes when the last block does.
  it('reads it again once no block names it any more', async () => {
    const { engine, asked } = withShipped(
      animatedModel([]),
      animatedModel([walk('NlaTrack')]),
      straightThrough(),
    )

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock())] })
    await vi.waitFor(() => expect(asked).toHaveLength(1))
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock())] })

    await vi.waitFor(() => expect(asked).toHaveLength(2))
    engine.dispose()
  })

  // Case 6 of the issue: a project file dropped for its motion. It carries a whole character, and
  // the scene must show none of it — only the model already standing there, moving.
  it('plays a project asset without ever letting its mesh into the scene', async () => {
    const loaded = animatedModel([])
    const source = animatedModel([walk('NlaTrack')])
    const { engine, asked } = withShipped(loaded, source, straightThrough())

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [modelNode(assetClip('block-1', 'asset-9', 'jig', { offset: 0.5 }))],
    })

    await vi.waitFor(() => expect(cubeOf(loaded).position.x).toBeCloseTo(0.5, 5))
    expect(asked).toEqual([assetUrl('asset-9')])
    expect(source.parent).toBeNull()
    engine.dispose()
  })

  // A role put right by hand lives in the character's own FILE — glTF has no other place for it,
  // and the port would otherwise go on deriving roles from names, which is what was corrected.
  it('tells the port what the file says this skeleton means', async () => {
    const retarget = straightThrough()
    const { engine } = withShipped(
      riggedModel([], { b0: 'Hips' }),
      animatedModel([walk('NlaTrack')]),
      retarget,
    )

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock())] })

    await vi.waitFor(() => expect(retarget.learnt).toHaveLength(1))
    expect(retarget.learnt[0]).toEqual({
      signature: skeletonSignatureOf(['b0', 'b1']),
      roles: { b0: 'Hips' },
    })
    engine.dispose()
  })

  // The port dies with the viewport, so a mapping worked out in one document would be worked out
  // again in the next: the project keeps it, and hands it back before anything is read.
  it('hands what a project already learnt to the port, and reports what it learns', async () => {
    const known: SkeletonProfile = { signature: skeletonSignatureOf(['x']), roles: { x: 'Hips' } }
    const retarget = straightThrough()
    const learnt: SkeletonProfile[] = []
    const engine = new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      loadModel: () => Promise.resolve(riggedModel([], { b0: 'Hips' })),
      retarget,
      profiles: [known],
      onProfile: profile => void learnt.push(profile),
      bvh,
    })

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock())] })

    expect(retarget.learnt[0]).toEqual(known)
    await vi.waitFor(() => expect(learnt).toHaveLength(1))
    expect(learnt[0]?.roles).toEqual({ b0: 'Hips' })
    engine.dispose()
  })

  it('leaves the model standing when the shipped file will not read', async () => {
    const loaded = animatedModel([])
    const { engine } = withShipped(loaded, new Error('no such folder'), straightThrough())

    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(shippedBlock())] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    expect(cubeOf(loaded).position.x).toBe(0)
    engine.dispose()
  })
})
