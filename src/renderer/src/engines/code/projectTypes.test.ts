import { describe, expect, it } from 'vitest'
import { projectTypes, type ProjectNames } from './projectTypes'

const nothing = (): ProjectNames => ({
  scenes: [],
  prefabs: [],
  entities: [],
  components: [],
  events: [],
})

describe('what a project tells an editor about itself', () => {
  it('spells each family as the literal union of what the project holds', () => {
    const held = projectTypes({ ...nothing(), scenes: ['World01', 'Menu'] })

    expect(held).toContain('export type SceneName = "Menu" | "World01"')
  })

  /** 🛑 A project with no prefab yet must not make every spawn an error. */
  it('widens an empty family back to a plain string', () => {
    expect(projectTypes(nothing())).toContain('export type PrefabName = string')
  })

  it('says a name once, in one order, whatever the project handed over', () => {
    const held = projectTypes({ ...nothing(), entities: ['b', 'a', 'b', ''] })

    expect(held).toContain('export type EntityName = "a" | "b"')
  })

  /** The declaration layers onto `@studio`, or an editor resolves none of it. */
  it('declares into the module a script imports', () => {
    expect(projectTypes(nothing())).toContain("declare module '@studio'")
  })
})
