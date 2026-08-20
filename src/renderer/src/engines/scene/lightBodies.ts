import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three'
import type { LightDescriptor } from '@shared/domain/scene'
import { lit, MARKER_NAME, solid } from './markerPaint'

/**
 * What each kind of lamp is DRAWN as. The two that aim are built facing +Z, which is what
 * `aimLightMarker` turns onto their target — three.js reads the node's rotation for neither.
 * Only the emitting part takes the lamp's colour; the frame stays neutral.
 */
export function lightBody(light: LightDescriptor, fill: string, edge: string): Object3D {
  switch (light.kind) {
    case 'ambient':
      return diffuseSphere(light.color, edge)
    case 'directional':
      return sun(light.color, fill, edge)
    case 'hemisphere':
      return skyGlobe(light.skyColor, light.groundColor, edge)
    case 'point':
      return bulb(light.color, fill, edge)
    case 'spot':
      return spotlight(light.color, light.angle, fill, edge)
  }
}

/**
 * What a lamp's own values are WRITTEN into, once the body exists. A slider emits a value per
 * frame, and rebuilding a spot on each one costs 0,56 ms of the 16,6 a frame has — for the same
 * fifteen geometries. Only a change of `kind` is a different body.
 */
export function applyLightBody(body: Object3D, light: LightDescriptor): void {
  body.traverse(part => {
    if (part.name === BARN_DOOR && light.kind === 'spot') {
      part.rotation.x = doorAngle(light.angle)
      return
    }
    if (!(part instanceof Mesh) || !(part.material instanceof MeshBasicMaterial)) return

    if (part.name === GLOW) part.material.color.set(lit(colourOf(light)))
    if (part.name === SKY && light.kind === 'hemisphere')
      part.material.color.set(lit(light.skyColor))
    if (part.name === GROUND && light.kind === 'hemisphere') {
      part.material.color.set(lit(light.groundColor))
    }
  })
}

/** The one colour a lamp glows. A hemisphere has two, and neither of them is this one. */
function colourOf(light: LightDescriptor): string {
  return light.kind === 'hemisphere' ? light.skyColor : light.color
}

const GLOW = 'glow'
const SKY = 'sky'
const GROUND = 'ground'

/** What a spot's four flaps answer to — the hinge, not the plate hanging off it. */
export const BARN_DOOR = 'barn-door'

function marker(): Object3D {
  const body = new Object3D()
  body.name = MARKER_NAME
  return body
}

/** A part that GLOWS: the lamp's own colour, lit by nothing, like every other piece of a marker. */
function glowing(geometry: BufferGeometry, colour: string, name = GLOW): Mesh {
  const part = new Mesh(geometry, new MeshBasicMaterial({ color: lit(colour) }))
  part.name = name
  return part
}

/** A part of the frame, flat: no relief to shade, and no outline worth a draw call. */
function flat(geometry: BufferGeometry, colour: string): Mesh {
  return new Mesh(geometry, new MeshBasicMaterial({ color: colour }))
}

/** A hoop 6 mm thick: past this, the extra segments cost triangles nobody can see. */
const RING_TUBE = 0.006
const RING_SEGMENTS = 14

const SUN_RAYS = 8

/** A sun: a globe in a crown of rays, and a shaft running to the point it lights. */
function sun(colour: string, fill: string, edge: string): Object3D {
  const body = marker()
  body.add(glowing(new SphereGeometry(0.085, 12, 8), colour))

  // Across the beam rather than around it: the crown is read from where the light lands.
  for (let index = 0; index < SUN_RAYS; index += 1) {
    const ray = glowing(new BoxGeometry(0.022, 0.07, 0.022), colour)
    const around = (index / SUN_RAYS) * Math.PI * 2
    ray.position.set(Math.cos(around) * 0.135, Math.sin(around) * 0.135, 0)
    ray.rotation.z = around - Math.PI / 2
    body.add(ray)
  }

  const shaft = solid(new CylinderGeometry(0.012, 0.012, 0.14, 8), fill, edge)
  shaft.rotation.x = Math.PI / 2
  shaft.position.z = 0.15

  const tip = solid(new CylinderGeometry(0, 0.04, 0.07, 12), fill, edge)
  tip.rotation.x = Math.PI / 2
  tip.position.z = 0.255

  body.add(shaft, tip)
  return body
}

const SPOT_NOSE = 0.1
const SPOT_LENGTH = 0.2
const SPOT_DOORS = 4

/** A studio spotlight: a flared housing, a coloured lens, four barn doors, a yoke and a foot. */
function spotlight(colour: string, angle: number, fill: string, edge: string): Object3D {
  const body = marker()

  const housing = solid(new CylinderGeometry(SPOT_NOSE, 0.07, SPOT_LENGTH, 16), fill, edge)
  housing.rotation.x = Math.PI / 2

  const lens = glowing(new CircleGeometry(SPOT_NOSE * 0.85, 16), colour)
  lens.position.z = SPOT_LENGTH / 2 + 0.001

  // Flat rather than shaded: a hoop that thin has no relief to show, and outlining it was 213 µs
  // of the 558 a spot cost to build — the single most expensive part of the lot.
  const yoke = flat(new TorusGeometry(0.125, 0.011, 4, RING_SEGMENTS, Math.PI), fill)
  yoke.rotation.set(Math.PI / 2, 0, 0)

  const foot = solid(new CylinderGeometry(0.045, 0.055, 0.03, 10), fill, edge)
  foot.position.y = -0.14

  body.add(housing, lens, yoke, foot)
  for (let index = 0; index < SPOT_DOORS; index += 1) body.add(barnDoor(index, angle, fill))
  return body
}

/** A quarter turn is shut — the flap lies along the beam; half the cone off it is where it sits. */
function doorAngle(angle: number): number {
  return Math.PI / 2 - angle / 2
}

/**
 * A flap hinged on the RIM, opened to half the cone. Two objects rather than one: the spin puts
 * the hinge at its quarter of the rim, and the tilt then turns about that hinge's own axis —
 * written as one Euler, the tilt turned about the body's axis and two flaps never opened at all.
 */
function barnDoor(index: number, angle: number, fill: string): Object3D {
  const spin = new Object3D()
  spin.position.z = SPOT_LENGTH / 2
  spin.rotation.z = (index / SPOT_DOORS) * Math.PI * 2

  const hinge = new Object3D()
  hinge.name = BARN_DOOR
  hinge.position.y = SPOT_NOSE
  hinge.rotation.x = doorAngle(angle)

  // Flat, again by measure: shading a 5 mm plate by face cost six draw calls apiece, and four
  // flaps were 28 of a spot's 39.
  const flap = flat(new BoxGeometry(0.13, 0.1, 0.005), fill)
  flap.position.y = 0.05
  hinge.add(flap)
  spin.add(hinge)
  return spin
}

const BULB_RAYS = 6

/** A bulb: glass in the lamp's colour, a screw cap, and short rays saying it lights every way. */
function bulb(colour: string, fill: string, edge: string): Object3D {
  const body = marker()

  const glass = glowing(new SphereGeometry(0.09, 12, 8), colour)
  glass.position.y = 0.05
  body.add(glass)

  for (let index = 0; index < BULB_RAYS; index += 1) {
    const ray = glowing(new BoxGeometry(0.055, 0.016, 0.016), colour)
    const around = (index / BULB_RAYS) * Math.PI * 2
    ray.position.set(Math.cos(around) * 0.14, 0.05, Math.sin(around) * 0.14)
    ray.rotation.y = -around
    body.add(ray)
  }

  const cap = solid(new CylinderGeometry(0.045, 0.055, 0.08, 12), fill, edge)
  cap.position.y = -0.08
  body.add(cap)
  return body
}

const GLOBE_RADIUS = 0.105

/**
 * A globe halved: sky above, ground below, an equator between them. The only marker that shows
 * two colours, because a hemisphere lamp is the only one that HAS two.
 */
function skyGlobe(skyColour: string, groundColour: string, edge: string): Object3D {
  const body = marker()

  const sky = glowing(
    new SphereGeometry(GLOBE_RADIUS, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    skyColour,
    SKY,
  )
  const ground = glowing(
    new SphereGeometry(GLOBE_RADIUS, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    groundColour,
    GROUND,
  )

  const equator = flat(new TorusGeometry(GLOBE_RADIUS + 0.004, RING_TUBE, 4, RING_SEGMENTS), edge)
  equator.rotation.x = Math.PI / 2

  body.add(sky, ground, equator)
  return body
}

/**
 * A core in three rings, deliberately without a front or a back: an ambient light has neither a
 * direction nor a position that means anything, and the shape has to say so.
 */
function diffuseSphere(colour: string, edge: string): Object3D {
  const body = marker()
  body.add(glowing(new SphereGeometry(0.062, 12, 8), colour))

  const ring = (x: number, y: number): Mesh => {
    const hoop = flat(new TorusGeometry(0.125, RING_TUBE, 4, RING_SEGMENTS), edge)
    hoop.rotation.set(x, y, 0)
    return hoop
  }

  body.add(ring(0, 0), ring(Math.PI / 2, 0), ring(0, Math.PI / 2))
  return body
}
