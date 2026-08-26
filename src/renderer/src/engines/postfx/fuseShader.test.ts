import { describe, expect, it } from 'vitest'
import { fuseShader, type FusableChunk } from './fuseShader'

const chunk = (kind: 'uv' | 'colour', body: string, uniforms = {}): FusableChunk => ({
  kind,
  uniforms,
  body,
})

/**
 * What this file measures is the PERFORMANCE decision of the whole folder: six per-pixel effects
 * compiled into one draw rather than six. Everything asserted below is what makes that merge
 * safe — the naming, the single fetch, and the order around it.
 */
describe('several per-pixel effects compiled into one shader', () => {
  it('renames every uniform per instance, so two of one effect do not collide', () => {
    const fused = fuseShader([
      chunk('colour', 'colour *= gain;', { gain: { value: 1 } }),
      chunk('colour', 'colour *= gain;', { gain: { value: 2 } }),
    ])

    expect(Object.keys(fused.uniforms).sort()).toEqual(['fx0_gain', 'fx1_gain', 'tDiffuse'])
    expect(fused.fragmentShader).toContain('colour *= fx0_gain;')
    expect(fused.fragmentShader).toContain('colour *= fx1_gain;')
  })

  it('hands each instance the map from its own name to the one in the shader', () => {
    const fused = fuseShader([chunk('colour', 'colour *= gain;', { gain: { value: 1 } })])

    expect(fused.naming).toEqual([{ gain: 'fx0_gain' }])
  })

  it('renames a helper and the calls to it together', () => {
    const fused = fuseShader([
      {
        kind: 'colour',
        uniforms: {},
        helpers: ['float doubled(float v) { return v * 2.0; }'],
        body: 'colour = vec3(doubled(colour.r));',
      },
    ])

    expect(fused.fragmentShader).toContain('float fx0_doubled(float v)')
    expect(fused.fragmentShader).toContain('vec3(fx0_doubled(colour.r))')
  })

  /** One fetch for the whole run — that IS the saving, and the reason the order is not free. */
  it('reads the texture exactly once, after the coordinates and before the colours', () => {
    const fused = fuseShader([chunk('uv', 'uv *= 2.0;'), chunk('colour', 'colour *= 0.5;')])
    const source = fused.fragmentShader

    expect(source.match(/texture2D\(tDiffuse/gu)).toHaveLength(1)
    expect(source.indexOf('uv *= 2.0;')).toBeLessThan(source.indexOf('texture2D(tDiffuse'))
    expect(source.indexOf('texture2D(tDiffuse')).toBeLessThan(source.indexOf('colour *= 0.5;'))
  })

  it('declares each uniform with the type its own value spells', () => {
    const fused = fuseShader([
      chunk('colour', 'colour *= amount;', {
        amount: { value: 1 },
        on: { value: true },
        size: { value: { x: 1, y: 2 } },
        tone: { value: { r: 1, g: 1, b: 1 } },
      }),
    ])

    expect(fused.fragmentShader).toContain('uniform float fx0_amount;')
    expect(fused.fragmentShader).toContain('uniform bool fx0_on;')
    expect(fused.fragmentShader).toContain('uniform vec2 fx0_size;')
    expect(fused.fragmentShader).toContain('uniform vec3 fx0_tone;')
  })

  /** Declared once whatever it fuses: a helper duplicated is a shader that will not compile. */
  it('writes the shared prelude once', () => {
    const fused = fuseShader([
      chunk('colour', 'colour *= dot(colour, LUMA);'),
      chunk('colour', 'colour *= dot(colour, LUMA);'),
    ])

    expect(fused.fragmentShader.match(/const vec3 LUMA/gu)).toHaveLength(1)
    expect(fused.fragmentShader.match(/float hash\(/gu)).toHaveLength(1)
  })

  it('compiles a chain of nothing into a shader that draws what it was given', () => {
    const fused = fuseShader([])

    expect(fused.fragmentShader).toContain('texture2D(tDiffuse')
    expect(Object.keys(fused.uniforms)).toEqual(['tDiffuse'])
  })
})
