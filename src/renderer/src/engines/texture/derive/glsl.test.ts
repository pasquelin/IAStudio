import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { PBR_CHANNELS } from '@shared/domain/texture'
import { sourceFor } from '../texture-state'
import { createDerivePass } from './derive-shaders'
import { createSeamPass } from './seam-shader'
import { LUMA, SOURCE_PREAMBLE } from './glsl'

const source = new Texture()
const SIZE = { width: 8, height: 8 }

/** Every shader assembled from the shared pieces — the derivations, and the seam measurement. */
const shaders = (): string[] => [
  ...PBR_CHANNELS.filter(sourceFor).map(
    channel => createDerivePass(channel, source, SIZE).material.fragmentShader,
  ),
  createSeamPass(source, SIZE).material.fragmentShader,
]

const occurrences = (text: string, line: string): number => text.split(line).length - 1

/**
 * The pieces are shared so the weights cannot drift, and a shared piece is only shared while
 * nobody keeps a copy beside it: a second `precision` or a second `LUMA` compiles on some
 * drivers and is a redefinition error on others, which is the kind of failure that only shows
 * on a machine nobody here owns.
 */
describe('the GLSL every off-screen pass shares', () => {
  it('is declared once in each shader it assembles', () => {
    for (const text of shaders()) {
      expect(occurrences(text, 'precision highp float;')).toBe(1)
      expect(occurrences(text, 'uniform sampler2D uSource;')).toBe(1)
      expect(occurrences(text, 'uniform vec2 uTexel;')).toBe(1)
      expect(occurrences(text, 'varying vec2 vUv;')).toBe(1)
    }
  })

  it('carries the same Rec. 709 weights everywhere it is read', () => {
    expect(LUMA).toContain('vec3(0.2126, 0.7152, 0.0722)')

    for (const text of shaders().filter(text => text.includes('LUMA'))) {
      expect(occurrences(text, LUMA)).toBe(1)
    }
  })

  it('hands every pass the uniforms its body reads', () => {
    for (const text of shaders()) expect(text).toContain(SOURCE_PREAMBLE)
  })
})
