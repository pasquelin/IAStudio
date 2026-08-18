import {
  AnimationClip,
  Bone,
  Group,
  Mesh,
  PerspectiveCamera,
  SphereGeometry,
  VectorKeyframeTrack,
} from 'three'
import type { Object3D } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  assetClip,
  bundledClip,
  clipLane,
  embeddedClip,
  type ClipRef,
} from '@shared/domain/scene'
import { bundledAnimationUrl } from '@shared/domain/animationLibrary'
import { assetUrl } from '@shared/domain/asset'
import { SceneRenderer } from './SceneRenderer'
import type { BvhBuilder } from './bvhBuilder'
import type { Retarget } from './retarget'
import type * as ModelCache from './modelCache'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture, meshNode, modelNodeFixture, pathNodeFixture } from './scene-fixtures'
import { EMPTY_SCENE, IDENTITY_TRANSFORM } from './sceneState'
import { EMPTY_TIMELINE, type AnimationTimeline, type CameraShot } from '@shared/domain/animation'
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
  const helpersAround = (loaded: Group): number =>
    (loaded.parent?.parent?.children ?? []).filter(child => child.type === 'SkeletonHelper').length

  it('draws no helper for a model that carries no bone', async () => {
    const loaded = animatedModel([walk()])
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(loaded.parent).not.toBeNull())
    expect(helpersAround(loaded)).toBe(0)
    engine.dispose()
  })

  it('hangs one beside the nodes for a rigged model, hidden until asked for', async () => {
    const loaded = rigged()
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })

    await vi.waitFor(() => expect(helpersAround(loaded)).toBe(1))

    const helper = (loaded.parent?.parent?.children ?? []).find(
      child => child.type === 'SkeletonHelper',
    )
    expect(helper?.visible).toBe(false)

    engine.setSkeletons(true)
    expect(helper?.visible).toBe(true)
    engine.dispose()
  })

  it('takes the helper away with the node it belonged to', async () => {
    const loaded = rigged()
    const engine = withModel(loaded)
    engine.apply({ ...EMPTY_SCENE, nodes: [modelNode(null)] })
    await vi.waitFor(() => expect(helpersAround(loaded)).toBe(1))

    // Kept before the node goes: the model is unparented with it, and the walk up would end early.
    const scene = loaded.parent?.parent
    engine.apply(EMPTY_SCENE)

    expect((scene?.children ?? []).filter(child => child.type === 'SkeletonHelper')).toHaveLength(0)
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

  /** A rail ten units long down X, a camera bound to it for the whole of a four-second shot. */
  const staged = (extra: Partial<CameraShot> = {}): SceneRenderer => {
    const engine = new SceneRenderer({ onSelect: () => {}, onTransform: () => {}, bvh })
    engine.apply({
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
    return engine
  }

  it('stands the camera at the start of the rail, and at its end when the shot is over', () => {
    const engine = staged()

    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(0, 4)

    // One microsecond before the end: a shot covers `[start, start + duration)`, so the very
    // instant it ends is already outside it — see `activeShotAt`.
    engine.setPlayhead(4 * SECOND - 1)
    expect(objectOf(engine, 'cam')?.position.x).toBeCloseTo(10, 4)
    engine.dispose()
  })

  // Placing the head straight there must give the very same pose as walking to it — the whole
  // reason nothing here accumulates frame by frame.
  it('gives the same place whether the head arrived in one step or in twenty', () => {
    const straight = staged()
    straight.setPlayhead(2.5 * SECOND)
    const once = objectOf(straight, 'cam')?.position.x ?? -1

    const walked = staged()
    for (let step = 1; step <= 20; step += 1) walked.setPlayhead((2.5 * SECOND * step) / 20)

    expect(objectOf(walked, 'cam')?.position.x).toBeCloseTo(once, 10)
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
        {
          id: 'lens',
          name: 'Lens',
          index: 0,
          muted,
          solo: false,
          locked: false,
          target: { nodeId: 'cam', property: 'fov' },
          keys: [
            { time: 0, value: { x: 0, y: 0, z: 0 } },
            { time: 2 * SECOND, value: { x: 20, y: 0, z: 0 } },
          ],
        },
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
    learnt: { bones: readonly string[]; roles: Readonly<Record<string, string>> }[]
  } => {
    const asked: { target: Object3D; clips: string[] }[] = []
    const learnt: { bones: readonly string[]; roles: Readonly<Record<string, string>> }[] = []
    return {
      asked,
      learnt,
      adapt: (target, _source, clips) => {
        asked.push({ target, clips: clips.map(clip => clip.name) })
        return Promise.resolve([...clips])
      },
      learn: (bones, roles) => learnt.push({ bones, roles }),
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

  // Case 19 of the issue: a role put right by hand lives in the document, and until now nothing
  // read it — the port went on deriving roles from names, which is what had been corrected.
  it('tells the port what the document says this skeleton means', async () => {
    const retarget = straightThrough()
    const { engine } = withShipped(animatedModel([]), animatedModel([walk('NlaTrack')]), retarget)
    const rest = {
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }
    const node = modelNode(shippedBlock())

    engine.apply({
      ...EMPTY_SCENE,
      nodes: [
        {
          ...node,
          model: {
            ...node.model,
            rig: {
              origin: 'local',
              bones: [
                { name: 'b0', parent: null, rest, role: 'Hips' },
                { name: 'b1', parent: 'b0', rest },
              ],
            },
          },
        },
      ],
    })

    await vi.waitFor(() => expect(retarget.learnt).toHaveLength(1))
    expect(retarget.learnt[0]).toEqual({ bones: ['b0', 'b1'], roles: { b0: 'Hips' } })
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
