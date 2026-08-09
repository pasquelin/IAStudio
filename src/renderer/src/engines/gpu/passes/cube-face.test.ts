import { describe, expect, it } from 'vitest'
import { CUBE_FACES, FACE_BASES } from '@shared/domain/skybox'
import { createCubeFacePass } from './cube-face'

const constantOf = (shader: string, name: string): number => {
  const found = shader.match(new RegExp(`const float ${name} = ([0-9.]+);`))
  if (!found?.[1]) throw new Error(`${name} is not declared`)
  return Number(found[1])
}

describe('the cube face pass', () => {
  it('starts with no source, so a face aimed before a picture arrives draws nothing', () => {
    const pass = createCubeFacePass()
    expect(pass.uniforms.uSource.value).toBeNull()
    pass.dispose()
  })

  it('declares every uniform its fragment shader reads', () => {
    const pass = createCubeFacePass()
    const declared = Object.keys(pass.uniforms)
    const read = [...pass.material.fragmentShader.matchAll(/uniform \w+ (\w+);/g)].map(m => m[1])

    expect(read.length).toBeGreaterThan(0)
    for (const name of read) expect(declared).toContain(name)
    pass.dispose()
  })

  it('carries the basis of the face it is aimed at, all three axes', () => {
    const pass = createCubeFacePass()

    for (const face of CUBE_FACES) {
      pass.setFace(face)
      expect(pass.uniforms.uForward.value.toArray()).toEqual([...FACE_BASES[face].forward])
      expect(pass.uniforms.uRight.value.toArray()).toEqual([...FACE_BASES[face].right])
      expect(pass.uniforms.uUp.value.toArray()).toEqual([...FACE_BASES[face].up])
    }

    pass.dispose()
  })

  it('writes into the vectors it already holds rather than making new ones', () => {
    const pass = createCubeFacePass()
    const forward = pass.uniforms.uForward.value

    pass.setFace('px')
    pass.setFace('ny')

    expect(pass.uniforms.uForward.value).toBe(forward)
    expect(forward.toArray()).toEqual([0, -1, 0])
    pass.dispose()
  })

  it('leaves the face out of the shader, which is what keeps one truth about the axes', () => {
    const pass = createCubeFacePass()
    // Whole words: a two-letter face name turns up inside ordinary prose — "any" holds `ny` —
    // and a substring match would fail on a comment rather than on a second table.
    for (const face of CUBE_FACES) {
      expect(pass.material.fragmentShader).not.toMatch(new RegExp(`\\b${face}\\b`))
    }
    pass.dispose()
  })

  it('samples on three own equirectangular constants, to the last digit that matters', () => {
    const pass = createCubeFacePass()
    const shader = pass.material.fragmentShader

    // Not decoration: a reciprocal typed one digit short turns the horizon by a fraction of a
    // degree, which reads as a soft seam down the middle of a face and nowhere else.
    expect(constantOf(shader, 'RECIPROCAL_PI')).toBeCloseTo(1 / Math.PI, 15)
    expect(constantOf(shader, 'RECIPROCAL_PI2')).toBeCloseTo(1 / (2 * Math.PI), 15)
    pass.dispose()
  })
})
