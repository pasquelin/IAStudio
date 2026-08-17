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
  type Light,
} from 'three'
import type { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { GeometryDescriptor, LightKind, PathDescriptor } from '@shared/domain/scene'
import { pathPoints } from './cameraPath'

/*
 * The three.js objects a descriptor maps to. Kept out of `SceneRenderer` on purpose: none of it
 * needs a GL context, so unlike the renderer it can be tested — and the argument order of
 * neighbouring three.js constructors is exactly the kind of thing only a test catches.
 */

const HELPER_SIZE = 0.5

/** Tube needs a path and Lathe a profile; both are fixed until a curve editor exists. */
const DEFAULT_TUBE_CURVE = new CatmullRomCurve3([
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

/** How big a control point is drawn, in scene units — a knob a pointer can actually land on. */
export const PATH_KNOB_RADIUS = 0.08

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
  const object = new Object3D()

  const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: colour }))
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

/** One knob, ready to be hung under a rail. Its index is what a pick reads out of its name. */
export function pathKnob(index: number, colour: string): Mesh {
  const knob = new Mesh(
    new SphereGeometry(PATH_KNOB_RADIUS, 8, 6),
    new MeshBasicMaterial({ color: colour }),
  )
  knob.name = knobName(index)
  return knob
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
