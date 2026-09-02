import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DirectionalLightHelper,
  DodecahedronGeometry,
  HemisphereLight,
  HemisphereLightHelper,
  IcosahedronGeometry,
  LatheGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  PointLightHelper,
  RingGeometry,
  SphereGeometry,
  SpotLight,
  SpotLightHelper,
  Sprite,
  TetrahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  TubeGeometry,
  Vector3,
  type Camera,
  type Light,
} from 'three'
import type { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import { ribbonGeometry } from './ribbonGeometry'
import type { GeometryDescriptor, LightKind, PathDescriptor } from '@shared/domain/scene'
import { pathPoints } from './cameraPath'
import { MARKER_NAME, solid } from './markerPaint'
import { screenScale } from '../viewport/screenScale'

/*
 * The three.js objects a descriptor maps to. Kept out of `SceneRenderer` on purpose: none of it
 * needs a GL context, so unlike the renderer it can be tested — and the argument order of
 * neighbouring three.js constructors is exactly the kind of thing only a test catches.
 */

const HELPER_SIZE = 0.5

/** Tube needs a path and Lathe a profile; both are fixed until a curve editor exists. */
export const DEFAULT_TUBE_CURVE = new CatmullRomCurve3([
  new Vector3(-0.5, 0, 0),
  new Vector3(0, 0.5, 0),
  new Vector3(0.5, 0, 0),
])

/** Exhaustive: a primitive added to the registry without a geometry here fails to compile. */
export function geometryFor(descriptor: GeometryDescriptor): BufferGeometry {
  switch (descriptor.kind) {
    case 'box':
      return new BoxGeometry(descriptor.width, descriptor.height, descriptor.depth)
    case 'capsule':
      return new CapsuleGeometry(
        descriptor.radius,
        descriptor.height,
        descriptor.capSegments,
        descriptor.radialSegments,
      )
    case 'circle':
      return new CircleGeometry(descriptor.radius, descriptor.segments)
    case 'cylinder':
      return new CylinderGeometry(
        descriptor.radiusTop,
        descriptor.radiusBottom,
        descriptor.height,
        descriptor.segments,
      )
    case 'dodecahedron':
      return new DodecahedronGeometry(descriptor.radius)
    case 'icosahedron':
      return new IcosahedronGeometry(descriptor.radius)
    case 'lathe':
      return new LatheGeometry(undefined, descriptor.segments)
    case 'octahedron':
      return new OctahedronGeometry(descriptor.radius)
    case 'plane':
      return new PlaneGeometry(descriptor.width, descriptor.height)
    case 'ribbon':
      return ribbonGeometry(descriptor)
    case 'ring':
      return new RingGeometry(descriptor.innerRadius, descriptor.outerRadius, descriptor.segments)
    case 'sphere':
      return new SphereGeometry(
        descriptor.radius,
        descriptor.widthSegments,
        descriptor.heightSegments,
      )
    case 'tetrahedron':
      return new TetrahedronGeometry(descriptor.radius)
    case 'torus':
      return new TorusGeometry(
        descriptor.radius,
        descriptor.tube,
        descriptor.radialSegments,
        descriptor.tubularSegments,
      )
    case 'torusKnot':
      // `tubularSegments` before `radialSegments` here, the reverse of `TorusGeometry` above.
      return new TorusKnotGeometry(
        descriptor.radius,
        descriptor.tube,
        descriptor.tubularSegments,
        descriptor.radialSegments,
        descriptor.p,
        descriptor.q,
      )
    case 'tube':
      return new TubeGeometry(
        DEFAULT_TUBE_CURVE,
        descriptor.tubularSegments,
        descriptor.radius,
        descriptor.radialSegments,
      )
  }
}

/** The class a kind maps to, bare: what goes in it is `applyLight`'s job, in `three-sync`. */
export function bareLight(kind: LightKind): Light {
  switch (kind) {
    case 'ambient':
      return new AmbientLight()
    case 'directional':
      return new DirectionalLight()
    case 'hemisphere':
      return new HemisphereLight()
    case 'point':
      return new PointLight()
    case 'spot':
      return new SpotLight()
  }
}

/** The four helper classes share no interface, so the union is what gives `update` a type. */
export type LightHelper =
  DirectionalLightHelper | HemisphereLightHelper | PointLightHelper | SpotLightHelper

/**
 * A light with no helper is invisible, and therefore unselectable: there is nothing under the
 * cursor to intersect. Ambient light is the exception — it has no position to draw.
 */
export function helperFor(light: Light): LightHelper | null {
  if (light instanceof DirectionalLight) return new DirectionalLightHelper(light, HELPER_SIZE)
  if (light instanceof HemisphereLight) return new HemisphereLightHelper(light, HELPER_SIZE)
  if (light instanceof PointLight) return new PointLightHelper(light, HELPER_SIZE)
  if (light instanceof SpotLight) return new SpotLightHelper(light)
  return null
}

/** Metres. A camera about the size of a hand, so it neither hides the set nor disappears in it. */
const CAMERA_BODY = { width: 0.24, height: 0.2, depth: 0.36 }

/**
 * A film camera: a body, a lens down its line of sight, and a magazine on top. It faces −Z, which
 * is where a `PerspectiveCamera` looks, so the lens says which way the shot goes.
 */
export function cameraBody(fill: string, edge: string): Object3D {
  const body = new Object3D()
  body.name = MARKER_NAME

  const shell = solid(
    new BoxGeometry(CAMERA_BODY.width, CAMERA_BODY.height, CAMERA_BODY.depth),
    fill,
    edge,
  )

  const lens = solid(new CylinderGeometry(0.06, 0.075, 0.16, 16), fill, edge)
  // Laid down the depth axis: a cylinder is born standing up the Y axis.
  lens.rotation.x = Math.PI / 2
  lens.position.z = -CAMERA_BODY.depth / 2 - 0.06

  const hood = solid(new CylinderGeometry(0.1, 0.085, 0.05, 16), fill, edge)
  hood.rotation.x = Math.PI / 2
  hood.position.z = -CAMERA_BODY.depth / 2 - 0.16

  const magazine = solid(new CylinderGeometry(0.09, 0.09, 0.05, 16), fill, edge)
  // Standing on its edge across the body, which is how a film magazine sits.
  magazine.rotation.z = Math.PI / 2
  magazine.position.set(0, CAMERA_BODY.height / 2 + 0.06, 0.04)

  body.add(shell, lens, hood, magazine)
  return body
}

/** How big a control point is built, in scene units. What it ends up drawn at is `KNOB_SHARE`. */
export const PATH_KNOB_RADIUS = 0.14

/** Past every surface of the scene, which all draw at zero — a handle one cannot see is no handle. */
const KNOB_ORDER = 10

/**
 * How much of the visible height a knob covers, whatever the distance: a hundred-and-twenty-eighth
 * of it, so about 14 px across on a viewport 900 px tall — the size a control point is drawn at in
 * the drawing tools a hand already knows.
 *
 * Seen on screen before it was settled. Deriving it from the 0,14 scene units arbitrated on
 * 18/08 gave 0,14/5, and that was a supposition rather than a measure — the framing it was
 * arbitrated on shows far more than five units of height, and the knobs came out the size of
 * coins.
 */
const KNOB_SHARE = 1 / 128

/** Reused rather than minted per knob per frame: this runs inside the render loop. */
const KNOB_SPOT = new Vector3()

/** What the line of a rail is called among its node's children, so a sync can find it again. */
export const PATH_CURVE_NAME = 'path-curve'

/** What a control point is called. The index follows, which is what a pick reads back. */
export const PATH_KNOB_PREFIX = 'path-knob-'

export function knobName(index: number): string {
  return `${PATH_KNOB_PREFIX}${index}`
}

/** Which control point a knob stands for, or `null` for an object that is not one. */
export function knobIndexOf(name: string): number | null {
  if (!name.startsWith(PATH_KNOB_PREFIX)) return null

  const index = Number(name.slice(PATH_KNOB_PREFIX.length))
  return Number.isInteger(index) && index >= 0 ? index : null
}

/**
 * A rail: the sampled curve, and one knob per control point.
 *
 * Knobs are meshes rather than a `Points` cloud because the gizmo attaches to an `Object3D` —
 * a point of a cloud is an index in a buffer, and nothing a transform control can hold.
 */
export function buildPath(descriptor: PathDescriptor, colour: string): Object3D {
  return dressWithRail(new Object3D(), descriptor, colour)
}

/**
 * The line and the knobs of a rail, hung under whatever carries it — a rail node, or the mesh of
 * a band swept along one. Both are edited through the same handles because both wear these.
 */
export function dressWithRail(
  object: Object3D,
  descriptor: PathDescriptor,
  colour: string,
): Object3D {
  const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: colour }))
  line.renderOrder = KNOB_ORDER
  line.name = PATH_CURVE_NAME
  line.geometry.setFromPoints(pathPoints(descriptor))
  object.add(line)

  for (const [index, point] of descriptor.points.entries()) {
    const knob = pathKnob(index, colour)
    knob.position.set(point.x, point.y, point.z)
    object.add(knob)
  }

  return object
}

/**
 * One knob, ready to be hung under a rail. Its index is what a pick reads out of its name.
 *
 * It keeps its size on SCREEN, resized against the camera about to draw it — which is why it is
 * done here and not once per frame: in a quad view four cameras draw the same knob, and one
 * scale could only ever be right for one of them.
 *
 * The matrix is recomposed by hand because three had already composed it for this draw: a scale
 * written and left there is a scale that shows up one frame late, and reads as a lag.
 */
export function pathKnob(index: number, colour: string): Mesh {
  const knob = new Mesh(
    new SphereGeometry(PATH_KNOB_RADIUS, 8, 6),
    // 🛑 Drawn THROUGH whatever stands in front: a rail of its own hangs in the air, but a band
    // is swept along its run, so every knob of one sits inside the matter it shapes.
    new MeshBasicMaterial({ color: colour, depthTest: false }),
  )
  knob.renderOrder = KNOB_ORDER
  knob.name = knobName(index)
  knob.onBeforeRender = (_renderer, _scene, camera) => sizeKnobFor(knob, camera)
  knob.onAfterRender = () => restoreKnob(knob)
  return knob
}

/** The knob resized for the camera about to draw it. Apart so it can be asked for by a test. */
export function sizeKnobFor(knob: Object3D, camera: Camera): void {
  knob.getWorldPosition(KNOB_SPOT)
  knob.scale.setScalar(screenScale(camera, KNOB_SPOT, KNOB_SHARE) / PATH_KNOB_RADIUS)
  knob.updateMatrixWorld(true)
}

/**
 * The knob put back to the size it was BUILT at, the moment its draw call is over.
 *
 * Or the scale of whichever camera drew last would outlive the frame, and everything that reads a
 * matrix outside the render reads that one: framing a rail would answer differently depending on
 * where the view stood before, the frustum of the side views would breathe, and exporting the
 * same scene twice would write two different files.
 */
export function restoreKnob(knob: Object3D): void {
  knob.scale.setScalar(1)
  knob.updateMatrixWorld(true)
}

const AXIS_KNOB_SCALE = 0.6

/**
 * `ViewHelper` offers no size option, so its knobs — sprites, unlike the mesh axes — are shrunk
 * in place.
 *
 * All six are shown, the three unlit ones included. They were hidden while the trihedron was
 * only a readout: the coloured knobs already name the axes, and the unlit ones added nothing.
 * They are buttons now, and the helper raycasts them whether or not they are drawn — hiding half
 * of a control while keeping it clickable is how a click lands on nothing anyone can see.
 */
export function tuneViewHelper(helper: ViewHelper): void {
  for (const child of helper.children) {
    if (child instanceof Sprite) child.scale.setScalar(AXIS_KNOB_SCALE)
  }
}
