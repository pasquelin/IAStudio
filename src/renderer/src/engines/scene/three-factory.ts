import {
  AmbientLight,
  BoxGeometry,
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
  type BufferGeometry,
  type Light,
} from 'three'
import type { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { GeometryDescriptor, LightKind } from '@shared/domain/scene'

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

const AXIS_KNOB_SCALE = 0.6

/**
 * `ViewHelper` offers no size option, so its knobs — sprites, unlike the mesh axes — are shrunk
 * in place, and the three unlit ones marking negative axes are hidden: the coloured ones already
 * identify them. Hidden rather than removed, so `dispose()` still frees the material they share.
 */
export function tuneViewHelper(helper: ViewHelper): void {
  for (const child of helper.children) {
    if (!(child instanceof Sprite)) continue
    const axis = child.userData.type
    if (typeof axis === 'string' && axis.startsWith('neg')) child.visible = false
    else child.scale.setScalar(AXIS_KNOB_SCALE)
  }
}
