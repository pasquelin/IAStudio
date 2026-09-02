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
import {
  EMPTY_TIMELINE,
  SCENE_SUBJECT_ID,
  sheetFromAnimated,
  type AnimationTimeline,
  type AnimationTrack,
} from '@shared/domain/animation'
import { newComponent, withComponentField } from '@shared/domain/componentRegistry'
import {
  postEffect,
  readParams,
  type PostEffect,
  type PostEffectId,
} from '@shared/domain/postProcessing'
import { SECOND, type Us } from '@shared/domain/time'
import {
  DEFAULT_CAMERA,
  DEFAULT_GROUND,
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
import { createDefaultScene } from './defaultScene'
import { airfieldNodes } from './airfieldLevel'
import { carNodes } from './carNodes'
import { CIRCUIT_START, CIRCUIT_START_YAW, circuitNodes } from './circuitLevel'
import { LYING_FLAT } from './levelParts'
import { MOUNTAIN_WORLD, mountainNodes } from './mountainLevel'
import { presetPatch } from './environmentPresets'
import { planeNodes } from './planeNodes'
import { cameraNode, groupNode, lightNode, meshNode, pathNode, transformAt } from './nodeFactory'
import { playgroundNodes } from './playgroundLevel'
import type { SceneNode, SceneState } from './sceneState'

const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }

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

/**
 * A camera on the +Z axis, aimed by its pitch alone — see `pitchTowards`. `distance` is measured
 * from what it LOOKS AT, which is at the origin unless `targetZ` says otherwise: a camera placed
 * at its distance from zero would frame the origin rather than the subject standing away from it.
 */
function aimedCamera(height: number, distance: number, targetHeight = 0, targetZ = 0): SceneNode {
  const rotation = { x: pitchTowards(height, distance, targetHeight), y: 0, z: 0 }
  return cameraNode(transformAt({ x: 0, y: height, z: targetZ + distance }, rotation))
}

/**
 * A camera on an arm, wired to what it films. Named parts, so an author can read the pair in the
 * outliner and retune it — which is the whole of what makes an arm worth having.
 */
function cameraRig(subject: string, over: Record<string, string | number> = {}): SceneNode {
  let arm = newComponent('SpringArm')
  for (const [key, value] of Object.entries({ subject, camera: CAMERA_NAME, ...over })) {
    arm = withComponentField(arm, key, value)
  }
  return { ...groupNode(transformAt(ORIGIN), 'Camera Rig'), components: [arm] }
}

const CAMERA_NAME = 'Camera'

/**
 * The working floor: wearing the checker, catching shadows, throwing none. Its tiling is the
 * studio default of one square per metre, which holds whatever `size` says — see `uvTiling`.
 */
function floor(size: number): SceneNode {
  return meshNode(
    { kind: 'plane', width: size, height: size },
    { transform: transformAt(ORIGIN, LYING_FLAT), castShadow: false, name: 'Floor' },
  )
}

/**
 * Whoever is PLAYED — a body the size of a person, carrying what walks it. Its capsule is the
 * controller's own default to the millimetre, so what is felt is what is seen.
 *
 * Off the origin, which the playground turned into an eight-metre hole: framed there, the two
 * templates that show a silhouette opened on one standing over a void.
 */
function standIn(): SceneNode {
  return {
    ...meshNode(
      { kind: 'capsule', radius: 0.3, height: 1.2, capSegments: 8, radialSegments: 16 },
      { transform: transformAt({ x: 0, y: 0.9, z: STAND_IN_Z }), name: 'Character' },
    ),
    components: [newComponent('CharacterController'), newComponent('Health')],
  }
}

/** Clear of the pit, on the floor band the two framed views open on. */
const STAND_IN_Z = 10

const KEY_LIGHT: Vector3 = { x: 5, y: 10, z: 7.5 }

function sun(intensity: number, position: Vector3 = KEY_LIGHT): SceneNode {
  return lightNode({ kind: 'directional', color: '#ffffff', intensity, target: ORIGIN }, position)
}

function ambient(intensity: number): SceneNode {
  return lightNode({ kind: 'ambient', color: '#404040', intensity }, ORIGIN)
}

/**
 * Sky above, bounced ground below — what keeps the shaded side of a wall readable instead of
 * flat grey. An ambient fills every face with the same light, which is what made the set read
 * as cardboard: it is a set one walks through, so its corners have to have depth.
 */
function skyLight(intensity: number): SceneNode {
  return lightNode(
    // A PALE ground colour, because the set has a pale floor: what bounces back is what stops a
    // wall in shade from going to the value of the sky behind it.
    { kind: 'hemisphere', skyColor: '#c2d8f2', groundColor: '#9a9384', intensity },
    { x: 0, y: 24, z: 0 },
  )
}

function pointLight(intensity: number, position: Vector3): SceneNode {
  return lightNode({ kind: 'point', color: '#ffffff', intensity, distance: 0, decay: 2 }, position)
}

/**
 * Plain white and no working texture: a backdrop is what a product is judged AGAINST, and it is
 * the one surface of the studio that is deliberately born bare — see `checkerTextures`.
 */
const BACKDROP: MaterialDescriptor = {
  kind: 'standard',
  color: '#f2f2f4',
  roughness: 1,
  metalness: 0,
  tilesPerMetre: 1,
  map: null,
  normalMap: null,
  roughnessMap: null,
  metalnessMap: null,
  aoMap: null,
  emissiveMap: null,
  displacementMap: null,
}

/**
 * A mirror-bright surface: what an occlusion pass and a reflection are read on, and what the
 * demonstration puts at the centre of its frame. Metal because a rough dielectric hides both.
 */
const METAL: MaterialDescriptor = {
  ...BACKDROP,
  color: '#dfe3ea',
  roughness: 0.14,
  metalness: 1,
}

/**
 * Feet on the ground, walking speed, eyes at 1,70 m — what the character templates share, and
 * the values the player will read the day it exists.
 */
const EYE_HEIGHT = 1.7

const WALKING: Partial<ScenePlay> = { eyeHeight: EYE_HEIGHT, moveSpeed: 4, gravity: 9.81 }

/**
 * The level, its light, and what the view adds on top — the three character templates differ by
 * that last part alone, which is the whole claim they make.
 */
function characterView(
  view: readonly SceneNode[],
  play: Partial<ScenePlay>,
  played?: string,
): Template {
  return {
    nodes: [...playgroundNodes(played), sun(2.2, { x: 22, y: 26, z: 16 }), skyLight(1.3), ...view],
    // The outdoor preset for its haze and its grading, but a PLAIN SKY behind rather than the
    // procedural studio: that one is nearly black, and a wall turned away from the sun landed on
    // the same value as the background — which reads as a wall that vanishes when one turns.
    // The colour is the haze's own, so the horizon closes instead of ending on a line.
    world: { ...presetPatch('outdoor'), background: { kind: 'color', color: '#b6c6d8' } },
    play: { ...WALKING, ...play },
  }
}

/** What a template settles, over the studio's own defaults. */
type Template = {
  nodes: readonly SceneNode[]
  world?: Partial<SceneWorld>
  play?: Partial<ScenePlay>
  /**
   * What the band already holds. Only the demonstration template uses it, and it is what makes
   * that one a DEMONSTRATION rather than a set: the whole chain — a move, a rack focus, a bloom
   * and an exposure — is already keyed, so pressing Play judges it in one gesture.
   */
  animation?: Partial<AnimationTimeline>
}

/** The three instance ids a channel of the demonstration aims at. The others are named once. */
const DEMO = { defocus: 'demo-dof', bloom: 'demo-bloom', grade: 'demo-grade' }

/** A parameter of the demonstration stack, set apart from what a fresh effect opens on. */
const tuned = (
  id: string,
  effect: PostEffectId,
  params: Record<string, number | string | boolean>,
): PostEffect => {
  // `readParams` rather than a spread: it fills in from the catalogue AND bounds what is given,
  // so a value that drifted out of its own slider is caught rather than written.
  return { ...postEffect(id, effect), params: readParams(effect, params) }
}

/** One composition channel of the demonstration, on the SCENE's own stack. */
const demoTrack = (
  id: string,
  effectId: string,
  param: string,
  keys: readonly { time: Us; value: number }[],
): AnimationTrack => ({
  id,
  name: id,
  index: 0,
  muted: false,
  solo: false,
  locked: false,
  target: { nodeId: SCENE_SUBJECT_ID, property: 'post', post: { effectId, param } },
  // Deltas over what the stack stores, like every other channel — see `postAt`.
  keys: keys.map(one => ({ time: one.time, value: { x: one.value, y: 0, z: 0 } })),
})

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

  /**
   * The scene the composition is JUDGED on, and everything in it is there for that.
   *
   * A metal sphere for the occlusion and the reflections, a lamp close enough to blow a highlight
   * past white for the bloom, a near post and a far wall for the defocus to have something to
   * choose between, and a camera already on a rail. Its own Default Post Processing is set, and
   * its band already holds § 14 and § 15: a travelling, a rack focus from 15 m to 2 m, a bloom
   * that flashes and an exposure that closes.
   */
  postProcessing: () => {
    const rail = pathNode()
    const camera = aimedCamera(1.5, 9, 1)

    return {
      nodes: [
        floor(40),
        meshNode(
          { kind: 'sphere', radius: 1, widthSegments: 48, heightSegments: 32 },
          {
            transform: transformAt({ x: 0, y: 1, z: 0 }),
            material: METAL,
            name: 'Metal Sphere',
          },
        ),
        // In FRONT of the sphere and off to one side: a rack focus needs something the near end
        // of its travel can be sharp on, and the sphere is where the far end lands.
        meshNode(
          { kind: 'cylinder', radiusTop: 0.12, radiusBottom: 0.12, height: 2.4, segments: 24 },
          { transform: transformAt({ x: -1.6, y: 1.2, z: 5 }), name: 'Foreground Post' },
        ),
        /*
         * Behind everything, which is what gives the haze and the occlusion a far end to read.
         *
         * Wide enough to FILL the frame, and a mid grey rather than the white cyclorama the photo
         * set wears: measured at the head, 50.7 % of the top-right third was clipped past 250
         * while the floor clipped none — the eye read a blown wall and a black void beside it,
         * and a composition judged against a clipped wall is judged against nothing.
         */
        meshNode(
          { kind: 'plane', width: 60, height: 16 },
          {
            transform: transformAt({ x: 0, y: 7, z: -9 }),
            material: { ...BACKDROP, color: '#8c8c92' },
            castShadow: false,
            name: 'Backdrop',
          },
        ),
        sun(1.6, { x: -6, y: 7, z: 5 }),
        ambient(0.2),
        // Twelve, not the sixty a spot four metres away carries: a point light falls off as the
        // square of a distance, and under two metres that is some eighteen times the same lamp.
        // It still blows the specular past white, which is what a bloom needs to find.
        pointLight(12, { x: 1.8, y: 2.2, z: 1.6 }),
        camera,
        rail,
      ],
      world: {
        ...presetPatch('studio'),
        post: {
          enabled: true,
          effects: [
            tuned('demo-gtao', 'gtao', { radius: 0.3, blend: 0.85 }),
            // A small aperture on purpose: the shot OPENS at fifteen metres — § 14 — so the
            // subject starts out of focus, and a wide one would open the template on a smear.
            tuned(DEMO.defocus, 'dof', { focusDistance: 15, aperture: 0.004, maxBlur: 0.012 }),
            tuned(DEMO.bloom, 'bloom', { strength: 0.35, radius: 0.5, threshold: 0.9 }),
            tuned(DEMO.grade, 'colorGrading', { contrast: 1.15, saturation: 0.98 }),
            tuned('demo-vignette', 'vignette', { offset: 0.9, darkness: 1.1 }),
            postEffect('demo-smaa', 'smaa'),
          ],
        },
      },
      animation: {
        duration: 5 * SECOND,
        shots: [
          {
            id: 'demo-shot',
            cameraId: camera.id,
            start: 0,
            duration: 5 * SECOND,
            motion: { pathId: rail.id, easing: 'easeInOut', from: 0, to: 1 },
            target: { kind: 'point', at: { x: 0, y: 1, z: 0 } },
          },
        ],
        tracks: [
          // § 14, to the metre: sharp at fifteen at the top of the shot, sharp at two by three
          // seconds — the rack focus a travelling is judged by.
          demoTrack('demo-focus', DEMO.defocus, 'focusDistance', [
            { time: 0, value: 0 },
            { time: 3 * SECOND, value: -13 },
          ]),
          /*
           * § 15: a flash that opens and closes rather than a level that rises and stays.
           *
           * Peaking at 1.5 rather than at 3: looked at, a peak of three drowned the sphere in its
           * own halo — the subject the rack focus had just brought into view disappeared behind
           * the effect meant to celebrate it. A flash one cannot see THROUGH is not a flash.
           */
          demoTrack('demo-flash', DEMO.bloom, 'strength', [
            { time: 0, value: 0 },
            { time: 1.5 * SECOND, value: 1.15 },
            { time: 3 * SECOND, value: 0 },
          ]),
          // The dark passage, in STOPS: one to four tenths of the light is about a stop and a
          // third, which is what `colorGrading` counts in.
          demoTrack('demo-exposure', DEMO.grade, 'exposure', [
            { time: 0, value: 0 },
            { time: 5 * SECOND, value: -1.32 },
          ]),
        ],
      },
    }
  },

  // The three below open on the SAME level and differ by where the camera stands — which is what
  // these three views are. A cadrage over an empty floor proved nothing: what makes them worth
  // picking is a set one can climb, fall off and bump into.
  // On the start pad, at eye height and facing down the set — where the walk begins the day a
  // controller reads `play`, rather than somewhere on the floor with the court behind it.
  firstPerson: () =>
    characterView([standIn(), cameraNode(transformAt({ x: 0, y: EYE_HEIGHT, z: STAND_IN_Z }))], {
      camera: 'firstPerson',
    }),

  // The camera stands back BEHIND the stand-in, which stands at z = 10 — over the shoulder means
  // both on the same axis, and the aim is at chest height.
  thirdPerson: () =>
    characterView(
      [standIn(), aimedCamera(2.4, 5, 1, STAND_IN_Z), cameraRig('Character', { height: 1.4 })],
      { camera: 'thirdPerson' },
    ),

  topDown: () =>
    characterView([standIn(), aimedCamera(16, 11, 0.9, STAND_IN_Z)], {
      camera: 'topDown',
      moveSpeed: 6,
    }),

  // 🛑 No stand-in, and that is not an omission: a walker wins the camera seat over a machine,
  // so a silhouette left on the pad would frame the car from a pair of feet.
  // 🛑 The arm aims down the CAR's own nose, not where the pointer looks: a car turning under a
  // camera the mouse alone aims reads as a car sliding sideways.
  car: () => ({
    nodes: [
      ...circuitNodes(),
      sun(2.4, { x: 60, y: 70, z: 40 }),
      skyLight(1.3),
      ...carNodes(CIRCUIT_START, CAR_NAME, CIRCUIT_START_YAW),
      aimedCamera(3, 10, 1, CIRCUIT_START.z),
      cameraRig(CAR_NAME, { orientation: 'subject', length: 8, height: 2.4 }),
    ],
    world: {
      ...presetPatch('outdoor'),
      background: { kind: 'color', color: '#b6c6d8' },
      // 🛑 The preset's own haze closes at 140 m and the circuit is 250 m across: the far side of
      // the loop was solid grey, which is why its shape could not be read at a glance.
      fog: { kind: 'linear', color: '#b6c6d8', near: 60, far: 420 },
      ground: { ...DEFAULT_GROUND, visible: true, size: 400, color: '#5c6b4f' },
    },
    play: { ...WALKING, camera: 'thirdPerson', played: CAR_NAME },
  }),

  /*
   * Already in the air: a plane born on the ground is a plane whose first minute is a taxi, and
   * there is nothing here to taxi to. The ground is the SCENE's own rather than a floor mesh —
   * five metres thick, where a plane meets a centimetre of one at sixty metres a second.
   */
  plane: () => ({
    nodes: [
      ...airfieldNodes(),
      ...mountainNodes(),
      sun(2.6, { x: 40, y: 50, z: 20 }),
      skyLight(1.4),
      ...planeNodes({ x: 0, y: CRUISE_ALTITUDE, z: 60 }),
      aimedCamera(CRUISE_ALTITUDE + 6, 30, CRUISE_ALTITUDE, 60),
    ],
    world: {
      ...presetPatch('outdoor'),
      background: { kind: 'color', color: '#9fc0e0' },
      // 🛑 The preset closes its haze at 140 m and this map is flown at 120: everything but the
      // wingtips was inside the fog. It now closes just short of the camera's own far plane, so
      // the horizon fades instead of being cut off.
      fog: { kind: 'linear', color: '#9fc0e0', near: 250, far: DEFAULT_CAMERA.far - 100 },
      // 🛑 Catches NO shadow: the map is kilometres across, so one shadow texel covers metres —
      // on a flat ground that reads as a grey moiré staircase, which made the editor unusable.
      ground: {
        ...DEFAULT_GROUND,
        visible: true,
        size: MOUNTAIN_WORLD,
        color: '#6f7f63',
        receiveShadow: false,
      },
    },
    play: { ...WALKING, camera: 'thirdPerson' },
  }),
}

/** Who the set's beacon and drone watch here, the stand-in being nowhere on this template. */
const CAR_NAME = 'Car'

/** Metres. High enough that a plane finding its speed has room to dip while it does. */
const CRUISE_ALTITUDE = 120

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
    animation: template.animation
      ? {
          ...EMPTY_TIMELINE,
          ...template.animation,
          // Derived rather than spelled out beside the tracks: a sheet written by hand drifts
          // from `readSheet` the day either moves, and an animated scene showing no line is a
          // state no file can be in.
          sheet: sheetFromAnimated(template.animation.tracks ?? [], template.animation.shots ?? []),
        }
      : EMPTY_TIMELINE,
  }
}
