import { describe, expect, it } from 'vitest'
import { aiRoleId, ASSISTANT_ROLE } from './aiRole'
import { landingOfRole } from './landingTarget'

describe('where an operation says its result belongs', () => {
  /** 🛑 The whole of ADR-23 here: the operation decides, never a preference read off disk. */
  it('rewrites what it was handed, and opens what it made from words', () => {
    expect(landingOfRole(aiRoleId('code', 'code2code'))).toBe('document')
    expect(landingOfRole(aiRoleId('code', 'txt2code'))).toBe('newTab')
  })

  /**
   * The families that land a row of the shelf still ask: a picture joins a canvas as a layer,
   * which is not the question this answers.
   */
  it('says nothing for a family that has not moved to the derivation', () => {
    expect(landingOfRole(aiRoleId('image', 'img2img'))).toBeNull()
    expect(landingOfRole(aiRoleId('skybox', 'txt2skybox'))).toBeNull()
  })

  it('says nothing with no operation, nor for a role that generates nothing', () => {
    expect(landingOfRole(null)).toBeNull()
    expect(landingOfRole(ASSISTANT_ROLE)).toBeNull()
  })
})
