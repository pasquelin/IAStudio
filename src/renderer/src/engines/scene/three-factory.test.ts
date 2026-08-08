import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  DirectionalLightHelper,
  HemisphereLight,
  HemisphereLightHelper,
  PointLight,
  PointLightHelper,
  SpotLight,
  SpotLightHelper,
  Mesh,
  PerspectiveCamera,
  Sprite,
  TorusGeometry,
  TorusKnotGeometry,
} from 'three'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIGHT_TYPES } from './light-types'
import { MESH_PRIMITIVES } from './mesh-primitives'
import { geometryFor, helperFor, tuneViewHelper } from './three-factory'
import { lightFor } from './three-sync'

describe('geometryFor', () => {
  it('builds every primitive the registry offers', () => {
    for (const primitive of MESH_PRIMITIVES) {
      if (!primitive.create) continue
      const geometry = geometryFor(primitive.create())
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
    }
  })

  it('passes box dimensions through in order', () => {
    const geometry = geometryFor({ kind: 'box', width: 2, height: 3, depth: 4 })
    expect(geometry).toBeInstanceOf(BoxGeometry)
    if (geometry instanceof BoxGeometry) {
      expect(geometry.parameters).toMatchObject({ width: 2, height: 3, depth: 4 })
    }
  })

  /**
   * three.js transposes these two on purpose — `TorusGeometry(…, radialSegments, tubularSegments)`
   * against `TorusKnotGeometry(…, tubularSegments, radialSegments)`. Nothing but a test catches a
   * swap here: both orders compile and both render something plausible.
   */
  it('respects the transposed segment order of torus and torus knot', () => {
    const torus = geometryFor({
      kind: 'torus',
      radius: 1,
      tube: 0.2,
      radialSegments: 7,
      tubularSegments: 31,
    })
    expect(torus).toBeInstanceOf(TorusGeometry)
    if (torus instanceof TorusGeometry) {
      expect(torus.parameters.radialSegments).toBe(7)
      expect(torus.parameters.tubularSegments).toBe(31)
    }

    const knot = geometryFor({
      kind: 'torusKnot',
      radius: 1,
      tube: 0.2,
      tubularSegments: 29,
      radialSegments: 5,
      p: 2,
      q: 3,
    })
    expect(knot).toBeInstanceOf(TorusKnotGeometry)
    if (knot instanceof TorusKnotGeometry) {
      expect(knot.parameters.tubularSegments).toBe(29)
      expect(knot.parameters.radialSegments).toBe(5)
      expect(knot.parameters.p).toBe(2)
      expect(knot.parameters.q).toBe(3)
    }
  })

  it('gives the cylinder its two radii in top-then-bottom order', () => {
    const geometry = geometryFor({
      kind: 'cylinder',
      radiusTop: 1,
      radiusBottom: 2,
      height: 3,
      segments: 8,
    })
    expect(geometry.type).toBe('CylinderGeometry')
  })
})

describe('lightFor', () => {
  it('builds every light the registry offers, with the matching class', () => {
    const classes = { ambient: AmbientLight, directional: DirectionalLight }
    for (const type of LIGHT_TYPES) {
      const light = lightFor(type.create())
      const expected = Reflect.get(classes, type.kind)
      if (typeof expected === 'function') expect(light).toBeInstanceOf(expected)
      expect(light.intensity).toBe(1)
    }
  })

  it('places the target of the aimed lights', () => {
    const light = lightFor({
      kind: 'spot',
      color: '#ffffff',
      intensity: 1,
      distance: 0,
      angle: 0.3,
      penumbra: 0,
      decay: 2,
      target: { x: 1, y: 2, z: 3 },
    })
    expect(light).toBeInstanceOf(SpotLight)
    if (light instanceof SpotLight) {
      expect(light.target.position.toArray()).toEqual([1, 2, 3])
    }
  })

  it('reads the two colours of a hemisphere light, sky then ground', () => {
    const light = lightFor({
      kind: 'hemisphere',
      skyColor: '#ff0000',
      groundColor: '#0000ff',
      intensity: 1,
    })
    expect(light).toBeInstanceOf(HemisphereLight)
    if (light instanceof HemisphereLight) {
      expect(light.color.getHexString()).toBe('ff0000')
      expect(light.groundColor.getHexString()).toBe('0000ff')
    }
  })
})

describe('helperFor', () => {
  it('gives each positioned light its own helper class', () => {
    expect(helperFor(new DirectionalLight())).toBeInstanceOf(DirectionalLightHelper)
    expect(helperFor(new HemisphereLight())).toBeInstanceOf(HemisphereLightHelper)
    expect(helperFor(new PointLight())).toBeInstanceOf(PointLightHelper)
    expect(helperFor(new SpotLight())).toBeInstanceOf(SpotLightHelper)
  })

  // An ambient light has no position, so there is nothing to draw and nothing to click.
  it('gives ambient light none', () => {
    expect(helperFor(new AmbientLight())).toBeNull()
  })

  it('covers every light the registry can build', () => {
    for (const type of LIGHT_TYPES) {
      const light = lightFor(type.create())
      const helper = helperFor(light)
      expect(type.kind === 'ambient' ? helper === null : helper !== null).toBe(true)
    }
  })
})

/**
 * `ViewHelper` paints its knobs on a 2D canvas, which the renderer test setup stubs to `null`
 * for every other suite. Given back here rather than globally: what the setup's comment says
 * still holds — the timeline checks for `null` before painting, and must keep doing so.
 */
function withCanvasContext(): void {
  const context = {
    beginPath: () => {},
    arc: () => {},
    closePath: () => {},
    fill: () => {},
    fillText: () => {},
  }

  // `as`: the helper reaches for five of a 2D context's hundred members, and `getContext` is
  // overloaded per context id — none of its returns is "the five methods this one uses".
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  )
}

describe('tuneViewHelper', () => {
  const helperOf = () => new ViewHelper(new PerspectiveCamera(), document.createElement('div'))

  beforeEach(withCanvasContext)
  afterEach(() => vi.restoreAllMocks())

  // The helper offers no size option: the knobs are shrunk where they stand.
  it('shrinks every knob', () => {
    const helper = helperOf()

    tuneViewHelper(helper)

    const knobs = helper.children.filter(child => child instanceof Sprite)
    expect(knobs.length).toBeGreaterThan(0)
    expect(knobs.every(sprite => sprite.scale.x < 1)).toBe(true)
  })

  /**
   * The three unlit knobs were hidden while the trihedron was only a readout. They are buttons
   * now, and the helper raycasts them whether or not they are drawn — one hidden would be a click
   * landing on nothing anyone can see.
   */
  it('leaves all six knobs showing, since all six are clickable', () => {
    const helper = helperOf()

    tuneViewHelper(helper)

    const knobs = helper.children.filter(child => child instanceof Sprite)
    expect(knobs).toHaveLength(6)
    expect(knobs.every(sprite => sprite.visible)).toBe(true)
  })

  it('leaves the axis meshes alone', () => {
    const helper = helperOf()
    const meshes = helper.children.filter(child => child instanceof Mesh)

    tuneViewHelper(helper)

    expect(meshes.every(mesh => mesh.scale.x === 1)).toBe(true)
  })
})
