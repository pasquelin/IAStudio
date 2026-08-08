import { describe, expect, it } from 'vitest'
import { Matrix3, ShaderLib, Texture, type IUniform } from 'three'
import {
  bindUniforms,
  createUniforms,
  EDGE_DEFINE,
  EDGE_INTENSITY,
  EDGE_MAP,
  EDGE_TRANSFORM,
  materialFrameOf,
  METALNESS_REMAP,
  patchFragment,
  remapOf,
  ROUGHNESS_REMAP,
  syncEdgeTransform,
} from './material-shader'
import { newTexture, type ChannelMap, type TextureState } from './texture-state'

const CHANNEL: ChannelMap = { assetId: 'a-1', origin: 'generated', width: 1024, height: 1024 }

const withChannels = (build: (texture: TextureState) => void): TextureState => {
  const texture = newTexture()
  build(texture)
  return texture
}

/** The real thing, so a rename in three fails this file rather than a sphere nobody looks at. */
const PHYSICAL = ShaderLib.physical.fragmentShader

describe('remapOf', () => {
  it('reads the range in order when the pixels read the right way round', () => {
    expect(remapOf({ min: 0.2, max: 0.8 })).toEqual({ x: 0.2, y: 0.8 })
  })

  it('swaps the ends of an inverted channel, which is what mixing backwards means', () => {
    expect(remapOf({ min: 0.2, max: 0.8 }, true)).toEqual({ x: 0.8, y: 0.2 })
  })

  it('turns the identity into a plain inversion', () => {
    expect(remapOf({ min: 0, max: 1 }, true)).toEqual({ x: 1, y: 0 })
  })
})

describe('patchFragment', () => {
  it('finds every anchor in the shader three actually ships', () => {
    expect(patchFragment(PHYSICAL).missing).toEqual([])
  })

  it('declares the remaps unconditionally and the cavity uniforms behind their define', () => {
    const { source } = patchFragment(PHYSICAL)

    expect(source).toContain(`uniform vec2 ${ROUGHNESS_REMAP};`)
    expect(source).toContain(`uniform vec2 ${METALNESS_REMAP};`)
    // Guarded: an unbound sampler is undefined behaviour on some drivers, so the define is what
    // decides whether the cavity code exists at all.
    expect(source).toMatch(
      new RegExp(`#ifdef ${EDGE_DEFINE}[\\s\\S]*uniform sampler2D ${EDGE_MAP};[\\s\\S]*#endif`),
    )
    expect(source).toContain(`uniform float ${EDGE_INTENSITY};`)
    expect(source).toContain(`uniform mat3 ${EDGE_TRANSFORM};`)
  })

  it('keeps `main` after the declarations rather than replacing it', () => {
    const { source } = patchFragment(PHYSICAL)

    expect(source).toContain('void main() {')
    expect(source.indexOf(`uniform vec2 ${ROUGHNESS_REMAP};`)).toBeLessThan(
      source.indexOf('void main() {'),
    )
  })

  it('rebuilds the roughness factor from the texel instead of scaling the product', () => {
    const { source } = patchFragment(PHYSICAL)

    // The scalar stays a multiplier: remapping `roughnessFactor` would move a texture that has
    // no roughness map at all, which is a slider lying about what it describes.
    expect(source).toContain(
      `roughnessFactor = roughness * mix( ${ROUGHNESS_REMAP}.x, ${ROUGHNESS_REMAP}.y, texelRoughness.g );`,
    )
    expect(source).toContain(
      `metalnessFactor = metalness * mix( ${METALNESS_REMAP}.x, ${METALNESS_REMAP}.y, texelMetalness.b );`,
    )
  })

  it('leaves the original chunk includes in place, so the texel exists to be read', () => {
    const { source } = patchFragment(PHYSICAL)

    expect(source).toContain('#include <roughnessmap_fragment>')
    expect(source).toContain('#include <metalnessmap_fragment>')
    expect(source).toContain('#include <aomap_fragment>')
  })

  it('darkens both diffuse terms and neither specular one', () => {
    const { source } = patchFragment(PHYSICAL)

    expect(source).toContain('reflectedLight.directDiffuse *= scCavity;')
    expect(source).toContain('reflectedLight.indirectDiffuse *= scCavity;')
    expect(source).not.toContain('Specular *= scCavity')
  })

  it('puts the cavity after the occlusion pass, where the diffuse terms are final', () => {
    const { source } = patchFragment(PHYSICAL)

    expect(source.indexOf('#include <aomap_fragment>')).toBeLessThan(source.indexOf('scCavity'))
    expect(source.indexOf('scCavity')).toBeLessThan(source.indexOf('vec3 totalDiffuse'))
  })

  it('names the anchor it could not find and keeps the rest of the patch', () => {
    const renamed = PHYSICAL.replace('#include <aomap_fragment>', '#include <occlusion_fragment>')

    const { source, missing } = patchFragment(renamed)

    expect(missing).toEqual(['#include <aomap_fragment>'])
    // The remaps still land: one chunk renamed upstream must not cost the other two.
    expect(source).toContain('texelRoughness.g')
    expect(source).not.toContain('scCavity')
  })

  it('reports every missing anchor rather than stopping at the first', () => {
    const { missing } = patchFragment('nothing a shader would recognise')

    // Named rather than counted: a fifth patch would break a count without any behaviour changing.
    expect(missing).toEqual([
      'void main() {',
      '#include <roughnessmap_fragment>',
      '#include <metalnessmap_fragment>',
      '#include <aomap_fragment>',
    ])
  })
})

describe('materialFrameOf', () => {
  it('sends the identity down when nothing has been remapped', () => {
    const frame = materialFrameOf(newTexture())

    expect(frame.roughnessRemap).toEqual({ x: 0, y: 1 })
    expect(frame.metalnessRemap).toEqual({ x: 0, y: 1 })
  })

  it('carries the range of each setting to its own channel', () => {
    const texture = withChannels(state => {
      state.material.roughnessRange = { min: 0.3, max: 0.7 }
      state.material.metalnessRange = { min: 0.1, max: 0.4 }
    })

    expect(materialFrameOf(texture).roughnessRemap).toEqual({ x: 0.3, y: 0.7 })
    expect(materialFrameOf(texture).metalnessRemap).toEqual({ x: 0.1, y: 0.4 })
  })

  /**
   * The regression this exists for: the texture converter answers with smoothness, and a channel
   * whose flag is not read lights the material inside out — matte where it should shine.
   */
  it('turns a channel stored backwards round, without the setting saying so', () => {
    const texture = withChannels(state => {
      state.channels.roughness = { ...CHANNEL, inverted: true }
    })

    expect(materialFrameOf(texture).roughnessRemap).toEqual({ x: 1, y: 0 })
  })

  it('inverts inside the range rather than around it', () => {
    const texture = withChannels(state => {
      state.material.roughnessRange = { min: 0.2, max: 0.9 }
      state.channels.roughness = { ...CHANNEL, inverted: true }
    })

    expect(materialFrameOf(texture).roughnessRemap).toEqual({ x: 0.9, y: 0.2 })
  })

  it('leaves the other channel alone when one of them reads backwards', () => {
    const texture = withChannels(state => {
      state.channels.roughness = { ...CHANNEL, inverted: true }
      state.channels.metalness = CHANNEL
    })

    expect(materialFrameOf(texture).metalnessRemap).toEqual({ x: 0, y: 1 })
  })

  /** A slider that darkens nothing is better than one that darkens a mask that is not there. */
  it('holds the cavity at zero until a mask is in the channel', () => {
    const set = withChannels(state => {
      state.material.edgeIntensity = 0.8
    })

    expect(materialFrameOf(set).edgeIntensity).toBe(0)

    const masked = withChannels(state => {
      state.material.edgeIntensity = 0.8
      state.channels.edge = CHANNEL
    })

    expect(materialFrameOf(masked).edgeIntensity).toBe(0.8)
  })
})

describe('bindUniforms', () => {
  it('publishes every uniform the patched source declares, under its GLSL name', () => {
    const uniforms = createUniforms()
    const target: Record<string, IUniform> = {}

    bindUniforms(target, uniforms)

    // Every published name is declared by the patched source. Asserting against the same constants
    // the function uses would have passed through any rename, pinning nothing.
    const { source } = patchFragment(PHYSICAL)
    for (const name of Object.keys(target)) expect(source).toContain(`${name};`)
    expect(Object.keys(target)).toHaveLength(5)

    // The same objects, not copies: three reads these on every frame, and a copy would freeze
    // the material on whatever the values were at compile time.
    expect(target[ROUGHNESS_REMAP]).toBe(uniforms.roughnessRemap)
    expect(target[EDGE_MAP]).toBe(uniforms.edgeMap)
  })

  it('starts on an identity remap, so an untouched texture renders what its maps hold', () => {
    const { roughnessRemap, metalnessRemap, edgeIntensity } = createUniforms()

    expect([roughnessRemap.value.x, roughnessRemap.value.y]).toEqual([0, 1])
    expect([metalnessRemap.value.x, metalnessRemap.value.y]).toEqual([0, 1])
    expect(edgeIntensity.value).toBe(0)
  })
})

describe('syncEdgeTransform', () => {
  it('copies the matrix of the mask, which is how it stays in step with the other maps', () => {
    const uniforms = createUniforms()
    const map = new Texture()
    map.repeat.set(4, 4)
    uniforms.edgeMap.value = map

    syncEdgeTransform(uniforms)

    // Copied, not shared: three rebuilds `matrix` in place on every update, and holding the same
    // object would work by accident until the day it does not.
    expect(uniforms.edgeTransform.value.elements).toEqual([...map.matrix.elements])
    expect(uniforms.edgeTransform.value).not.toBe(map.matrix)
    expect(uniforms.edgeTransform.value.elements[0]).toBe(4)
  })

  it('updates the matrix before reading it, since nothing else builds one for this map', () => {
    const uniforms = createUniforms()
    const map = new Texture()
    uniforms.edgeMap.value = map
    map.offset.set(0.25, 0.5)

    syncEdgeTransform(uniforms)

    // Written out rather than read back off `map.matrix`: comparing the copy to its source passes
    // whether or not `updateMatrix` ran, because both would then be the identity.
    expect(uniforms.edgeTransform.value.elements[6]).toBeCloseTo(0.25)
    expect(uniforms.edgeTransform.value.elements[7]).toBeCloseTo(0.5)
  })

  it('leaves the identity in place while no mask is loaded', () => {
    const uniforms = createUniforms()

    syncEdgeTransform(uniforms)

    expect(uniforms.edgeTransform.value.equals(new Matrix3())).toBe(true)
  })
})
