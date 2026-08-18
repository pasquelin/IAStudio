import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  DirectionalLight,
  DirectionalLightHelper,
  DodecahedronGeometry,
  HemisphereLight,
  HemisphereLightHelper,
  IcosahedronGeometry,
  LatheGeometry,
  Line,
  LineBasicMaterial,
  LineSegments,
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
import type { GeometryDescriptor, LightKind, PathDescriptor } from '@shared/domain/scene'
import { pathPoints } from './cameraPath'
import { screenScale } from '../viewport/screenScale'

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

/**
 * What a camera and a light are DRAWN as, so a scene reads as a set rather than as a wireframe.
 *
 * A body a hand recognises, and one that stays under the pointer: the outline of a frustum is
 * four lines and a hair to click, and it says nothing about which way the thing faces until it is
 * read carefully. These are what stand in the view at rest; the wireframe aids — the frustum, the
 * cone of a spot — are what selection adds on top.
 *
 * Lit by nothing: a marker painted with a standard material goes black in a scene whose lamps are
 * off, which is exactly the scene somebody is trying to light. `MeshBasicMaterial` at a flat token
 * colour is readable whatever the scene does, and shading is faked by the shape alone.
 */
export const MARKER_NAME = 'workshop-marker'

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

/**
 * A part of a marker: a solid SHADED by the way its faces point, plus the edges that outline it.
 *
 * Baked into the materials rather than lit, and that is the whole trick: a marker has to survive
 * a scene whose lamps are all off — which is exactly the scene somebody is trying to light — so
 * no light may touch it. Painting the top lighter and the underside darker gives the volume a
 * lamp would have given it, at no cost and in every scene.
 *
 * A box takes its six faces in three's own order (+X, −X, +Y, −Y, +Z, −Z) and a cylinder takes
 * three (side, top, bottom); anything else takes one and leans on its edges.
 */
function solid(geometry: BufferGeometry, fill: string, edge: string): Object3D {
  const faces = shadedFaces(geometry, fill)
  const mesh = new Mesh(geometry, faces.length === 1 ? faces[0] : faces)
  mesh.add(new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: edge })))
  return mesh
}

/** How much lighter a face turned up is, and how much darker one turned down — of its lightness. */
const FACE_LIGHT = 1.3
const FACE_DARK = 0.62
const FACE_SIDE = 0.85

function shadedFaces(geometry: BufferGeometry, fill: string): MeshBasicMaterial[] {
  const shade = (amount: number): MeshBasicMaterial =>
    new MeshBasicMaterial({ color: dimmed(fill, amount) })

  if (geometry instanceof BoxGeometry) {
    return [
      shade(1),
      shade(FACE_SIDE),
      shade(FACE_LIGHT),
      shade(FACE_DARK),
      shade(1),
      shade(FACE_SIDE),
    ]
  }
  if (geometry instanceof CylinderGeometry) return [shade(1), shade(FACE_LIGHT), shade(FACE_DARK)]
  return [shade(1)]
}

/**
 * The same hue and the same saturation, its LIGHTNESS put through `shade` — a shade of the
 * marker, never a second colour. What tells two faces of one helper apart, and what keeps a bulb
 * visible on a dark viewport.
 */
function relit(colour: string, shade: (lightness: number) => number): Color {
  const hsl = { h: 0, s: 0, l: 0 }
  const held = new Color(colour)
  held.getHSL(hsl)
  return held.setHSL(hsl.h, hsl.s, shade(hsl.l))
}

/** A share of the lightness, for the relief of a helper painted by face orientation. */
function dimmed(colour: string, amount: number): Color {
  return relit(colour, lightness => Math.min(1, lightness * amount))
}

/**
 * A bulb, glowing in the light's own colour so a lamp says what it does before it is clicked.
 *
 * The glass takes the colour and the cap stays neutral — an unlit token — so a white lamp is
 * still told from the grey of everything else.
 */
export function lightBulb(colour: string, fill: string, edge: string): Object3D {
  const bulb = new Object3D()
  bulb.name = MARKER_NAME

  const glass = new Mesh(
    new SphereGeometry(0.11, 16, 12),
    new MeshBasicMaterial({ color: lit(colour) }),
  )
  glass.position.y = 0.06

  const cap = solid(new CylinderGeometry(0.05, 0.06, 0.09, 12), fill, edge)
  cap.position.y = -0.07

  bulb.add(glass, cap)
  return bulb
}

/**
 * A lamp's own colour, brought up to where it can be SEEN. An ambient light ships at #222222 and
 * a bulb painted with it is a black ball on a dark viewport — the colour still says which lamp
 * this is, the lightness only says that there is one.
 */
function lit(colour: string): Color {
  return relit(colour, lightness => Math.max(lightness, 0.62))
}

/** How big a control point is built, in scene units. What it ends up drawn at is `KNOB_SHARE`. */
export const PATH_KNOB_RADIUS = 0.14

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
    new MeshBasicMaterial({ color: colour }),
  )
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
