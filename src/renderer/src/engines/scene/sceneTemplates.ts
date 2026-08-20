/**
 * What each scene template opens on, as plain state.
 *
 * A template is code and nothing else: no file to fetch, no model to download, no asset the
 * project has to hold first. What it may reference is what the app ships with — the working
 * textures — and a project that has not installed them yet gets plain surfaces rather than
 * nothing at all.
 *
 * No three.js here on purpose: this is reached from the door that creates a document, which the
 * rail and the home page both press, and neither may pull a renderer in to open a tab.
 */
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import {
  DEFAULT_WORLD,
  type MaterialDescriptor,
  type ScenePlay,
  type SceneWorld,
  type Vector3,
} from '@shared/domain/scene'
import {
  DEFAULT_SCENE_TEMPLATE,
  isSceneTemplateId,
  type SceneTemplateId,
} from '@shared/domain/sceneTemplate'
import { defaultMeshMaterial } from './checkerTextures'
import { createDefaultScene } from './defaultScene'
import { presetPatch } from './environmentPresets'
import { cameraNode, lightNode, meshNode, pathNode, transformAt } from './nodeFactory'
import { playgroundNodes } from './playgroundLevel'
import type { SceneNode, SceneState } from './sceneState'

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }

/** A `plane` stands upright, and a floor is the one thing that must not. */
const LYING_FLAT: Vector3 = { x: -Math.PI / 2, y: 0, z: 0 }

/**
 * The pitch that aims a camera standing at `height`, `distance` away on the +Z axis, at a point
 * `targetHeight` above the origin.
 *
 * Every camera below stands on that axis, and this is why: a node's rotation is read as Euler
 * XYZ, where a yaw and a pitch together do not compose the way a camera is aimed. With no yaw
 * the orders agree, and one angle says the whole thing.
 */
export function pitchTowards(height: number, distance: number, targetHeight = 0): number {
  return Math.atan2(targetHeight - height, distance)
}

/** A camera on the +Z axis, aimed by its pitch alone — see `pitchTowards`. */
function aimedCamera(height: number, distance: number, targetHeight = 0): SceneNode {
  const rotation = { x: pitchTowards(height, distance, targetHeight), y: 0, z: 0 }
  return cameraNode(transformAt({ x: 0, y: height, z: distance }, rotation))
}

/**
 * The working floor: wearing the checker, catching shadows, throwing none — and tiled one square
 * per metre, where a single stretch of the picture over sixty makes a floor read as a blur.
 */
function floor(size: number): SceneNode {
  return meshNode(
    { kind: 'plane', width: size, height: size },
    {
      transform: transformAt(ORIGIN, LYING_FLAT),
      material: { ...defaultMeshMaterial(), uvScale: size },
      castShadow: false,
    },
  )
}

/** A stand-in the size of a person — what the three character templates frame. */
function standIn(): SceneNode {
  return meshNode(
    { kind: 'capsule', radius: 0.3, height: 1.2, capSegments: 8, radialSegments: 16 },
    { transform: transformAt({ x: 0, y: 0.9, z: 0 }) },
  )
}

const KEY_LIGHT: Vector3 = { x: 5, y: 10, z: 7.5 }

function sun(intensity: number, position: Vector3 = KEY_LIGHT): SceneNode {
  return lightNode({ kind: 'directional', color: '#ffffff', intensity, target: ORIGIN }, position)
}

function ambient(intensity: number): SceneNode {
  return lightNode({ kind: 'ambient', color: '#404040', intensity }, ORIGIN)
}

function pointLight(intensity: number, position: Vector3): SceneNode {
  return lightNode({ kind: 'point', color: '#ffffff', intensity, distance: 0, decay: 2 }, position)
}

/** Plain white and no working texture: a backdrop is what a product is judged AGAINST. */
const BACKDROP: MaterialDescriptor = {
  kind: 'standard',
  color: '#f2f2f4',
  roughness: 1,
  metalness: 0,
  uvScale: 1,
  map: null,
  normalMap: null,
  roughnessMap: null,
  metalnessMap: null,
  aoMap: null,
}

/**
 * Feet on the ground, walking speed, eyes at 1,70 m — what the character templates share, and
 * the values the player will read the day it exists.
 */
const WALKING: Partial<ScenePlay> = { eyeHeight: 1.7, moveSpeed: 4, gravity: 9.81 }

/**
 * The level, its light, and what the view adds on top — the three character templates differ by
 * that last part alone, which is the whole claim they make.
 */
function characterView(view: readonly SceneNode[], play: Partial<ScenePlay>): Template {
  return {
    nodes: [...playgroundNodes(), sun(2.4, { x: 14, y: 18, z: 10 }), ambient(0.5), ...view],
    play: { ...WALKING, ...play },
  }
}

/** What a template settles, over the studio's own defaults. */
type Template = {
  nodes: readonly SceneNode[]
  world?: Partial<SceneWorld>
  play?: Partial<ScenePlay>
}

const BUILDERS: Record<SceneTemplateId, () => Template> = {
  // The studio's own default, unchanged: three lights and nothing else. Lit rather than truly
  // bare — an unlit scene reads as a broken viewport, not as a document waiting to be filled.
  empty: () => ({ nodes: createDefaultScene().nodes }),

  // A floor, a sun, a fill, a camera — and a cube of one metre. The cube is what says how big a
  // metre is here, and it is the first thing to delete once a model of one's own arrives.
  basic: () => ({
    nodes: [
      floor(20),
      meshNode(
        { kind: 'box', width: 1, height: 1, depth: 1 },
        { transform: transformAt({ x: 0, y: 0.5, z: 0 }) },
      ),
      sun(2),
      ambient(0.6),
      aimedCamera(2, 6, 0.5),
    ],
  }),

  // The product preset brings the light ground and the filmic grading; what is added here is the
  // backdrop that turns a floor into a set, and the three-point rig standing on it.
  photoStudio: () => ({
    nodes: [
      meshNode(
        { kind: 'plane', width: 12, height: 8 },
        { transform: transformAt({ x: 0, y: 4, z: -5 }), material: BACKDROP, castShadow: false },
      ),
      floor(12),
      lightNode(
        {
          kind: 'spot',
          color: '#ffffff',
          intensity: 60,
          distance: 0,
          angle: 0.6,
          penumbra: 0.4,
          decay: 2,
          target: ORIGIN,
        },
        { x: 3, y: 5, z: 4 },
      ),
      pointLight(20, { x: -4, y: 2, z: 3 }),
      pointLight(15, { x: 0, y: 3, z: -3 }),
      aimedCamera(1.2, 4, 0.8),
    ],
    world: presetPatch('product'),
  }),

  // A camera AND the rail it runs along, which is the point of the template: the shot is already
  // a move rather than a still. The haze is what gives a set depth on camera.
  cinematic: () => ({
    nodes: [
      floor(60),
      sun(1.6, { x: -8, y: 6, z: 4 }),
      ambient(0.3),
      aimedCamera(1.6, 8, 1.2),
      pathNode(),
    ],
    world: {
      ...presetPatch('night'),
      fog: { kind: 'linear', color: '#1b2029', near: 12, far: 90 },
    },
  }),

  // The sky IS the backdrop, and the sun is low enough to cast the long shadows a facade reads
  // by. The floor is wide because a building is not a prop.
  archvis: () => ({
    nodes: [floor(200), sun(3, { x: -30, y: 25, z: 15 }), aimedCamera(1.7, 14, 3)],
    world: presetPatch('outdoor'),
    play: { ...WALKING, camera: 'firstPerson' },
  }),

  // The three below open on the SAME level and differ by where the camera stands — which is what
  // these three views are. A cadrage over an empty floor proved nothing: what makes them worth
  // picking is a set one can climb, fall off and bump into.
  firstPerson: () =>
    characterView([cameraNode(transformAt({ x: 0, y: 1.7, z: 14 }))], {
      camera: 'firstPerson',
    }),

  thirdPerson: () => characterView([standIn(), aimedCamera(2.4, 5, 1)], { camera: 'thirdPerson' }),

  topDown: () =>
    characterView([standIn(), aimedCamera(16, 11, 0.9)], { camera: 'topDown', moveSpeed: 6 }),
}

/**
 * The scene a template opens on. A fresh state on every call, ids included — two documents made
 * from one template share nothing.
 */
export function sceneFromTemplate(id: SceneTemplateId = DEFAULT_SCENE_TEMPLATE): SceneState {
  // Checked although the type says it cannot be wrong: the id crosses the boundary from the
  // naming window, and one this build has never heard of would throw on `BUILDERS[id]()`.
  const template = BUILDERS[isSceneTemplateId(id) ? id : DEFAULT_SCENE_TEMPLATE]()

  return {
    nodes: [...template.nodes],
    selectedIds: [],
    world: {
      ...DEFAULT_WORLD,
      ...template.world,
      play: { ...DEFAULT_WORLD.play, ...template.play },
    },
    animation: EMPTY_TIMELINE,
  }
}
