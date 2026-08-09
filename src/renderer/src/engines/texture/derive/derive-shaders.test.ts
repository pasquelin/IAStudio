import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { sourceFor } from '../texture-state'
import { createDerivePass } from './derive-shaders'

const source = new Texture()

const shaderFor = (channel: PbrChannel): string =>
  createDerivePass(channel, source, { width: 8, height: 8 }).material.fragmentShader

const derivable = PBR_CHANNELS.filter(channel => sourceFor(channel) !== null)

describe('the derivation shaders', () => {
  /**
   * The two tables that have to agree, and neither is derived from the other: `sourceFor` says
   * what a channel reads, the shader table says how it is computed. A channel with a source and
   * no shader offers a derivation that cannot run; a shader with no source has nothing to read.
   */
  it('has a shader for exactly the channels the domain gives a source', () => {
    for (const channel of PBR_CHANNELS) {
      const build = () => shaderFor(channel)
      if (sourceFor(channel)) expect(build).not.toThrow()
      else expect(build).toThrow(/no shader derives/)
    }
  })

  /** A zero divides into an infinite texel step, and every tap lands on the same pixel. */
  it('refuses a source with no pixels', () => {
    expect(() => createDerivePass('normal', source, { width: 0, height: 8 })).toThrow(/no pixels/)
  })

  it('steps by one texel of the source it was given, on each axis separately', () => {
    const pass = createDerivePass('normal', source, { width: 2048, height: 512 })

    expect(pass.uniforms.uTexel.value.x).toBeCloseTo(1 / 2048)
    expect(pass.uniforms.uTexel.value.y).toBeCloseTo(1 / 512)
    expect(pass.uniforms.uSource.value).toBe(source)
  })

  it('computes each channel with its own shader', () => {
    expect(new Set(derivable.map(shaderFor)).size).toBe(derivable.length)
  })

  /**
   * A normal points into every octant, and the file it lands in holds eight bits per channel
   * with no sign. Written raw, half the surface would clamp to black.
   */
  it('encodes the normal into the unit interval on the way out', () => {
    expect(shaderFor('normal')).toContain('normal * 0.5 + 0.5')
  })

  /** The whole point of a Sobel: the four diagonals weigh in, so one noisy texel is not a spike. */
  it('reads the eight neighbours of a pixel to slope it', () => {
    expect(shaderFor('normal').match(/heightAt\(vec2\(/g) ?? []).toHaveLength(8)
  })

  /** Same picture read the other way round: what one calls deep, the other calls matte. */
  it('inverts the luminance for roughness and not for height', () => {
    expect(shaderFor('roughness')).toContain('1.0 - luma')
    expect(shaderFor('height')).not.toContain('1.0 - luma')
  })

  /** Every pass is opaque: an alpha below one would be read back as premultiplied noise. */
  it('writes a fully opaque pixel', () => {
    for (const channel of derivable) {
      expect(shaderFor(channel)).toMatch(/gl_FragColor = vec4\([^;]*, 1\.0\);/)
    }
  })
})
