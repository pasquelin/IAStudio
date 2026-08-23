import { describe, expect, it } from 'vitest'
import { aiRoleId, DICTATION_ROLE } from '@shared/domain/aiRole'
import { roleLabel } from './roleLabel'

const key = (name: string): string => name

describe('roleLabel', () => {
  // The vocabulary the cloud catalogue already publishes, rather than a second one for the same
  // idea — ADR-21 § A.
  it('names a generation role with the family and the capability the catalogue uses', () => {
    expect(roleLabel(aiRoleId('image', 'inpaint'), key)).toBe(
      'families.image · capabilities.inpaint',
    )
  })

  /**
   * « Agrandissement · Agrandissement » is what the pair reads for a family whose single
   * employment shares its name, and it says nothing the family had not already said.
   */
  it('names a single-employment family by the family alone', () => {
    expect(roleLabel(aiRoleId('upscale', 'upscale'), key)).toBe('families.upscale')
    expect(roleLabel(aiRoleId('vectorization', 'vectorize'), key)).toBe('families.vectorization')
  })

  it('names a standalone role on its own, having no family to borrow from', () => {
    expect(roleLabel(DICTATION_ROLE, key)).toBe('aiRoles.dictation')
  })
})
