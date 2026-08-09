import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import {
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
const anyTexture = (): Texture | undefined => new Texture()

function shaderOf(picture: ResolvedPicture): string {
  const { material } = createPackPass(picture, anyTexture)
  return material.fragmentShader
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
    const { material } = createPackPass(pictureNamed('unreal', '_ORM'), anyTexture)
    const bound = Object.keys(material.uniforms)

    expect(bound).toEqual(['uSource0', 'uSource1', 'uSource2'])
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
    const shader = shaderOf(pictureNamed('unreal', '_ORM'))
    const call = shader.slice(shader.indexOf('gl_FragColor'))

    // Occlusion, roughness, metallic — in that order, each off its own sampler's red.
    expect(call).toContain('texture2D(uSource0, vUv).r,')
    expect(call).toContain('texture2D(uSource1, vUv).r,')
    expect(call).toContain('texture2D(uSource2, vUv).r,')
  })

  it('inverts only the component whose recipe asked for it', () => {
    const shader = shaderOf(pictureNamed('unreal', '_Normal'))

    expect(shader).toContain('(1.0 - texture2D(uSource0, vUv).g)')
    expect(shader).not.toContain('(1.0 - texture2D(uSource0, vUv).r)')
    expect(shader).not.toContain('(1.0 - texture2D(uSource0, vUv).b)')
  })

  it('writes a constant as a float, which is the only thing GLSL will read it as', () => {
    const shader = shaderOf(pictureNamed('unity', '_MaskMap'))

    // Blue is held at zero on this recipe: `0` alone is an int, and vec4 refuses it.
    expect(shader).toMatch(/\n\s+0\.0,/)
    expect(shader).not.toMatch(/\n\s+0,/)
  })

  it('holds a missing channel at the value the recipe named', () => {
    const noOcclusion: ExportChannels = { roughness: { assetId: 'a-roughness' } }
    const orm = resolvePictures('unreal', noOcclusion, 'mat').find(p => p.name === 'mat_ORM')
    if (!orm) throw new Error('no ORM')

    const shader = shaderOf(orm)

    expect(shader).toContain('1.0,')
    expect(shader).toContain('0.0')
    expect(shader).toContain('uniform sampler2D uSource0;')
    expect(shader).not.toContain('uSource1')
  })

  it('opens the four components in the order red, green, blue, alpha', () => {
    const shader = shaderOf(pictureNamed('unity', '_MaskMap'))
    const call = shader.slice(shader.indexOf('vec4('))

    const metallic = call.indexOf('uSource0')
    const occlusion = call.indexOf('uSource1')
    const smoothness = call.indexOf('uSource2')

    expect(metallic).toBeGreaterThan(-1)
    expect(occlusion).toBeGreaterThan(metallic)
    expect(smoothness).toBeGreaterThan(occlusion)
  })

  it('refuses a picture whose channel nobody decoded, rather than sampling black', () => {
    expect(() => createPackPass(pictureNamed('unreal', '_ORM'), () => undefined)).toThrow(
      /was not decoded/,
    )
  })
})
