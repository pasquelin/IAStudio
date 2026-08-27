import { describe, expect, it } from 'vitest'
import { projectTypes } from './projectTypes'

describe('what a project tells an editor about itself', () => {
  it('augments the studio module with the literal union of what the project holds', () => {
    const held = projectTypes({ components: ['Health', 'Movement'] })

    expect(held).toContain("declare module '@studio'")
    expect(held).toContain('components: "Health" | "Movement"')
  })

  /**
   * 🛑 Nothing at all rather than an empty union: `StudioNames` stays un-augmented, so every name
   * of `studio.d.ts` widens back to `string` on its own — a project holding none must not make
   * every use of the name an error. Proved end to end by `redBeforePlay.test.ts`.
   */
  it('declares nothing while the project holds nothing', () => {
    expect(projectTypes({ components: [] })).not.toContain('interface StudioNames')
  })

  it('says a name once, in one order, whatever the project handed over', () => {
    expect(projectTypes({ components: ['b', 'a', 'b', ''] })).toContain('components: "a" | "b"')
  })
})
