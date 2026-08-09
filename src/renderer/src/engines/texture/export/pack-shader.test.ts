import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import {
  assetsOf,
  resolvePictures,
  type ExportChannels,
  type ResolvedPicture,
} from '@shared/domain/texture-export'
import { createPackPass } from './pack-shader'

const CHANNELS: ExportChannels = {
  baseColor: { assetId: 'a-base' },
  normal: { assetId: 'a-normal' },
  roughness: { assetId: 'a-roughness' },
  metalness: { assetId: 'a-metalness' },
  ao: { assetId: 'a-ao' },
}

function pictureNamed(target: 'unreal' | 'unity' | 'roblox', suffix: string): ResolvedPicture {
  const found = resolvePictures(target, CHANNELS, 'mat').find(p => p.name === `mat${suffix}`)
  if (!found) throw new Error(`no picture named mat${suffix}`)
  return found
}

/** Every asset decodes, which is what a run that reached the pass would have handed over. */
function decoded(picture: ResolvedPicture): Texture[] {
  return assetsOf(picture).map(() => new Texture())
}

function shaderOf(picture: ResolvedPicture): string {
  return createPackPass(picture, decoded(picture)).material.fragmentShader
}

/**
 * The four arguments of the `vec4`, in order. Read as a list rather than searched for: a
 * `toContain('1.0,')` passes on every recipe, because alpha is 1 on every recipe — it said
 * nothing about which component carried what.
 */
function componentsOf(picture: ResolvedPicture): string[] {
  const shader = shaderOf(picture)
  return shader
    .slice(shader.indexOf('vec4('), shader.indexOf('\n  );'))
    .split('\n')
    .slice(1)
    .map(line => line.trim().replace(/,$/, ''))
}

describe('the packing shader', () => {
  it('declares one sampler per channel the picture reads, and no more', () => {
    const shader = shaderOf(pictureNamed('unreal', '_ORM'))

    expect(shader).toContain('uniform sampler2D uSource0;')
    expect(shader).toContain('uniform sampler2D uSource1;')
    expect(shader).toContain('uniform sampler2D uSource2;')
    expect(shader).not.toContain('uSource3')
  })

  it('binds each sampler to the channel its slot reads', () => {
    const orm = pictureNamed('unreal', '_ORM')
    const { material } = createPackPass(orm, decoded(orm))

    expect(Object.keys(material.uniforms)).toEqual(['uSource0', 'uSource1', 'uSource2'])
  })

  it('reads one asset through one sampler, however many components want it', () => {
    const shader = shaderOf(pictureNamed('roblox', '_ColorMap'))

    expect(shader).toContain('uniform sampler2D uSource0;')
    expect(shader).not.toContain('uSource1')
    expect(shader).toContain('texture2D(uSource0, vUv).r')
    expect(shader).toContain('texture2D(uSource0, vUv).g')
    expect(shader).toContain('texture2D(uSource0, vUv).b')
  })

  it('puts each channel of an ORM on the component the format reads it from', () => {
    // Occlusion, roughness, metallic — in that order, each off its own sampler's red.
    expect(componentsOf(pictureNamed('unreal', '_ORM'))).toEqual([
      'texture2D(uSource0, vUv).r',
      'texture2D(uSource1, vUv).r',
      'texture2D(uSource2, vUv).r',
      '1.0',
    ])
  })

  it('inverts only the component whose recipe asked for it', () => {
    expect(componentsOf(pictureNamed('unreal', '_Normal'))).toEqual([
      'texture2D(uSource0, vUv).r',
      '(1.0 - texture2D(uSource0, vUv).g)',
      'texture2D(uSource0, vUv).b',
      '1.0',
    ])
  })

  it('writes a constant as a float, which is the only thing GLSL will read it as', () => {
    // Blue is held at zero on this recipe: `0` alone is an int, and vec4 refuses it.
    expect(componentsOf(pictureNamed('unity', '_MaskMap'))[2]).toBe('0.0')
  })

  it('holds a missing channel at the value the recipe named, on its own component', () => {
    const noOcclusion: ExportChannels = { roughness: { assetId: 'a-roughness' } }
    const orm = resolvePictures('unreal', noOcclusion, 'mat').find(p => p.name === 'mat_ORM')
    if (!orm) throw new Error('no ORM')

    // Not occluded on red, the roughness that is there on green, not metal on blue.
    expect(componentsOf(orm)).toEqual(['1.0', 'texture2D(uSource0, vUv).r', '0.0', '1.0'])
  })

  it('mixes between the two ends of a remapped window', () => {
    const narrowed: ExportChannels = {
      roughness: { assetId: 'a-roughness', range: { min: 0.25, max: 0.75 } },
    }
    const orm = resolvePictures('unreal', narrowed, 'mat').find(p => p.name === 'mat_ORM')
    if (!orm) throw new Error('no ORM')

    expect(componentsOf(orm)[1]).toBe('mix(0.25, 0.75, texture2D(uSource0, vUv).r)')
  })

  it('opens the four components in the order red, green, blue, alpha', () => {
    expect(componentsOf(pictureNamed('unity', '_MaskMap'))).toEqual([
      'texture2D(uSource0, vUv).r',
      'texture2D(uSource1, vUv).r',
      '0.0',
      '(1.0 - texture2D(uSource2, vUv).r)',
    ])
  })

  it('refuses a picture whose channel nobody decoded, rather than sampling black', () => {
    expect(() => createPackPass(pictureNamed('unreal', '_ORM'), [])).toThrow(/was not decoded/)
  })
})
