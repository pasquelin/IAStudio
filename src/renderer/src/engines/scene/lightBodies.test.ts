import { Box3, Mesh, MeshBasicMaterial, SRGBColorSpace, Vector3, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import type { LightDescriptor } from '@shared/domain/scene'
import { applyLightBody, BARN_DOOR, lightBody } from './lightBodies'
import { LIGHT_TYPES } from './lightTypes'
import { MARKER_NAME } from './markerPaint'

const FILL = '#9aa0a6'
const EDGE = '#101010'

function shadesOf(body: Object3D): MeshBasicMaterial[] {
  const shades: MeshBasicMaterial[] = []
  body.traverse(part => {
    if (!(part instanceof Mesh)) return
    const materials = Array.isArray(part.material) ? part.material : [part.material]
    for (const material of materials) {
      if (material instanceof MeshBasicMaterial) shades.push(material)
    }
  })
  return shades
}

/**
 * Lightness is raised so a near-black lamp stays visible: the hue is what says which lamp.
 *
 * Read in sRGB, the space the descriptor wrote its colour in. `getHSL` answers in the working
 * space by default, and the linear transfer moves a hue enough to fail a comparison — #ff8000
 * reads 0,08 as it was typed and 0,04 as it is stored.
 */
function huesOf(body: Object3D): number[] {
  return shadesOf(body).map(
    material => material.color.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).h,
  )
}

function carriesHue(body: Object3D, hue: number): boolean {
  return huesOf(body).some(painted => Math.abs(painted - hue) < 0.01)
}

/** How far each flap reaches from the beam's axis — one number per barn door, in build order. */
function doorSpreadOf(body: Object3D): number[] {
  body.updateWorldMatrix(false, true)
  const reaches: number[] = []
  body.traverse(part => {
    if (part.name !== BARN_DOOR) return
    const tip = part.children[0]?.getWorldPosition(new Vector3())
    if (tip) reaches.push(Math.hypot(tip.x, tip.y))
  })
  return reaches
}

const spotOf = (angle: number): LightDescriptor => ({
  kind: 'spot',
  color: '#ffffff',
  intensity: 1,
  distance: 0,
  angle,
  penumbra: 0,
  decay: 2,
  target: { x: 0, y: 0, z: 0 },
})

describe('lightBody', () => {
  it('gives every light the registry offers a body of its own', () => {
    for (const type of LIGHT_TYPES) {
      const body = lightBody(type.create(), FILL, EDGE)

      expect(body.name).toBe(MARKER_NAME)
      expect(shadesOf(body).length).toBeGreaterThan(0)
    }
  })

  it('paints the emitting part in the lamp own colour', () => {
    // Cyan: a hue no token of the marker frame carries, so finding it proves the lamp painted it.
    const body = lightBody(
      { kind: 'point', color: '#00ffff', intensity: 1, distance: 0, decay: 2 },
      FILL,
      EDGE,
    )

    expect(carriesHue(body, 0.5)).toBe(true)
  })

  /** The frame says "lamp", the colour says "which lamp": a body painted all over says neither. */
  it('leaves the frame neutral, whatever colour the lamp is', () => {
    const body = lightBody(spotOf(0.4), FILL, EDGE)

    const saturations = shadesOf(body).map(
      material => material.color.getHSL({ h: 0, s: 0, l: 0 }).s,
    )
    expect(saturations.some(saturation => saturation < 0.1)).toBe(true)
  })

  it('shows both colours of a hemisphere lamp, which no single bulb could', () => {
    const body = lightBody(
      { kind: 'hemisphere', skyColor: '#00ffff', groundColor: '#ff8000', intensity: 1 },
      FILL,
      EDGE,
    )

    expect(carriesHue(body, 0.5)).toBe(true)
    expect(carriesHue(body, 0.0833)).toBe(true)
  })

  /**
   * Every flap, not the box around them: written as one Euler, the tilt turned about the body's
   * axis and TWO of the four never opened — while the bounding box still grew, because the two
   * that did open moved it. A box is what let a broken shape read as a working one.
   */
  it('opens all four barn doors wider as the cone widens', () => {
    const narrow = doorSpreadOf(lightBody(spotOf(0.05), FILL, EDGE))
    const wide = doorSpreadOf(lightBody(spotOf(1.4), FILL, EDGE))

    expect(narrow).toHaveLength(4)
    expect(wide.every((spread, door) => spread > (narrow[door] ?? Infinity))).toBe(true)
  })

  /** Four flaps at four quarters: one that sat behind the housing said nothing about the beam. */
  it('spaces the barn doors evenly around the beam', () => {
    const spread = doorSpreadOf(lightBody(spotOf(0.4), FILL, EDGE))

    expect(spread.every(reach => Math.abs(reach - (spread[0] ?? 0)) < 1e-6)).toBe(true)
  })

  /**
   * A slider emits a value per frame. Rebuilding a spot on each one costs 0,56 ms of the 16,6 a
   * frame has, to produce the same fifteen geometries — so what a body reads is WRITTEN into it.
   */
  it('repaints a lamp without replacing a single part of its body', () => {
    const body = lightBody(
      { kind: 'point', color: '#00ffff', intensity: 1, distance: 0, decay: 2 },
      FILL,
      EDGE,
    )
    const parts = shadesOf(body)

    applyLightBody(body, { kind: 'point', color: '#ff8000', intensity: 1, distance: 0, decay: 2 })

    expect(shadesOf(body)).toEqual(parts)
    expect(carriesHue(body, 0.0837)).toBe(true)
    expect(carriesHue(body, 0.5)).toBe(false)
  })

  it('reopens the barn doors when the cone widens, without rebuilding them', () => {
    const body = lightBody(spotOf(0.1), FILL, EDGE)
    const narrow = new Box3().setFromObject(body).max.y

    applyLightBody(body, spotOf(1.2))

    expect(new Box3().setFromObject(body).max.y).toBeGreaterThan(narrow)
  })

  it('repaints both halves of a hemisphere globe', () => {
    const body = lightBody(
      { kind: 'hemisphere', skyColor: '#00ffff', groundColor: '#ff8000', intensity: 1 },
      FILL,
      EDGE,
    )

    applyLightBody(body, {
      kind: 'hemisphere',
      skyColor: '#ff8000',
      groundColor: '#00ffff',
      intensity: 1,
    })

    expect(carriesHue(body, 0.5)).toBe(true)
    expect(carriesHue(body, 0.0837)).toBe(true)
  })

  /**
   * `lookAt` turns +Z onto the target, so a body that aims has to be BUILT facing +Z — the sun by
   * its shaft, the spot by its nose. Drawn backwards, both would point away from what they light.
   */
  it('builds the lights that aim facing +Z', () => {
    const sun = new Box3().setFromObject(
      lightBody(
        { kind: 'directional', color: '#ffffff', intensity: 1, target: { x: 0, y: 0, z: 0 } },
        FILL,
        EDGE,
      ),
    )
    const spot = new Box3().setFromObject(lightBody(spotOf(0.4), FILL, EDGE))

    expect(sun.max.z).toBeGreaterThan(Math.abs(sun.min.z))
    expect(spot.max.z).toBeGreaterThan(Math.abs(spot.min.z))
  })
})
