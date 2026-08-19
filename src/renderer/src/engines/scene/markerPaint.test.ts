import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  LineBasicMaterial,
  LineSegments,
  MeshBasicMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Mesh,
} from 'three'
import { describe, expect, it } from 'vitest'
import { lit, solid } from './markerPaint'

const FILL = '#808080'
const EDGE = '#101010'

function shadesOf(part: Mesh): MeshBasicMaterial[] {
  const materials = Array.isArray(part.material) ? part.material : [part.material]
  return materials.filter(material => material instanceof MeshBasicMaterial)
}

/** In sRGB, where the lamp's colour was picked and where the shades are worked out. */
function lightnessOf(colour: Color): number {
  return colour.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).l
}

describe('solid', () => {
  /**
   * A marker has to survive a scene whose lamps are all off — which is exactly the scene somebody
   * is trying to light. Anything lit would go black there.
   */
  it('paints a part with materials no light can touch', () => {
    const part = solid(new BoxGeometry(1, 1, 1), FILL, EDGE)

    const materials = Array.isArray(part.material) ? part.material : [part.material]
    expect(shadesOf(part)).toHaveLength(materials.length)
  })

  it('shades a box by face so its volume reads without a lamp', () => {
    // three's own face order, +Y third and −Y fourth: up lighter than down is the whole trick.
    const [, , up = 0, down = 1] = shadesOf(solid(new BoxGeometry(1, 1, 1), FILL, EDGE)).map(
      material => lightnessOf(material.color),
    )

    expect(up).toBeGreaterThan(down)
  })

  it('gives a box six shades, a cylinder three, and anything else one', () => {
    expect(shadesOf(solid(new BoxGeometry(1, 1, 1), FILL, EDGE))).toHaveLength(6)
    expect(shadesOf(solid(new CylinderGeometry(1, 1, 1), FILL, EDGE))).toHaveLength(3)
    expect(shadesOf(solid(new SphereGeometry(1), FILL, EDGE))).toHaveLength(1)
  })

  it('outlines the part in the edge colour', () => {
    const part = solid(new BoxGeometry(1, 1, 1), FILL, EDGE)

    const outline = part.children.find(child => child instanceof LineSegments)
    expect(outline?.material).toBeInstanceOf(LineBasicMaterial)
    if (outline?.material instanceof LineBasicMaterial) {
      expect(outline.material.color.getHexString()).toBe('101010')
    }
  })
})

describe('lit', () => {
  /**
   * An ambient light ships at #222222, and a bulb painted with it is a black ball on a dark
   * viewport. The colour still says which lamp this is; the lightness only says there is one.
   */
  it('brings a near-black lamp colour up to where it can be seen', () => {
    expect(lightnessOf(lit('#222222'))).toBeGreaterThan(0.5)
  })

  /**
   * Read where the colour was WRITTEN. Raising the lightness in the working space instead washes
   * a saturated lamp out — measured on #ff8000, which came back #ffaa86, a salmon.
   */
  it('keeps the hue and saturation the lamp was given', () => {
    const before = { h: 0, s: 0, l: 0 }
    const after = { h: 0, s: 0, l: 0 }
    new Color('#ff8000').getHSL(before, SRGBColorSpace)

    lit('#ff8000').getHSL(after, SRGBColorSpace)

    expect(after.h).toBeCloseTo(before.h, 4)
    expect(after.s).toBeCloseTo(before.s, 4)
  })
})
