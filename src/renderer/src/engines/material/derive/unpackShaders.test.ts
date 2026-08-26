import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { createUnpackPass } from './unpackShaders'

const componentOf = (channel: 'roughness' | 'metalness' | 'ao'): string => {
  const shader = createUnpackPass(channel, new Texture()).fragmentShader
  return shader.slice(shader.indexOf('vUv).') + 'vUv).'.length, shader.indexOf('), 1.0)'))
}

describe('reading a channel out of a packed picture', () => {
  /**
   * glTF § 3.9.2: roughness is green and metalness is blue of one image, occlusion red when a
   * third rides along. Read rather than guessed — which is what tells this from a derivation.
   */
  it('takes each channel from the component the standard stores it in', () => {
    expect(componentOf('roughness')).toBe('g')
    expect(componentOf('metalness')).toBe('b')
    expect(componentOf('ao')).toBe('r')
  })

  it('refuses a channel no component holds', () => {
    expect(() => createUnpackPass('baseColor', new Texture())).toThrow('baseColor')
  })
})
