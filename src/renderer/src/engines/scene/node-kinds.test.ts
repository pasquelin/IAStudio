import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import { LIGHT_ENTRIES, MESH_ENTRIES, OBJECT_ENTRIES } from '@shared/domain/scene'
import { ADD_ENTRIES, NODE_KINDS } from './node-kinds'

describe('ADD_ENTRIES', () => {
  it('offers every family in the order the registries declare', () => {
    expect(ADD_ENTRIES).toHaveLength(
      MESH_ENTRIES.length + LIGHT_ENTRIES.length + OBJECT_ENTRIES.length,
    )
    expect(ADD_ENTRIES[0]?.entry.kind).toBe('box')
    expect(ADD_ENTRIES.at(-1)?.entry.kind).toBe('text')
  })

  // The key is derived, not declared: a missing string renders as `meshes.torusKnot` in the
  // toolbar, in both panels and in the native menu at once.
  it('has a translation behind every derived label key', () => {
    for (const { labelKey } of ADD_ENTRIES) expect(i18next.exists(labelKey)).toBe(true)
  })

  // The mechanism stays — a kind declared before it can be built is shown greyed rather than
  // hidden — but nothing uses it any more: every entry the menus offer now builds a node.
  it('greys nothing, every announced kind being buildable', () => {
    expect(ADD_ENTRIES.filter(({ entry }) => entry.disabled)).toEqual([])
  })

  // A kind with no glyph draws an empty button, which reads as a broken row rather than a tool.
  it('gives every entry an icon', () => {
    for (const { entry } of ADD_ENTRIES) expect(entry.icon).toBeTruthy()
  })
})

describe('NODE_KINDS', () => {
  it('names a namespace whose panel strings exist', () => {
    for (const { namespace } of Object.values(NODE_KINDS)) {
      expect(i18next.exists(`${namespace}.empty`)).toBe(true)
      expect(i18next.exists(`${namespace}.noDocument`)).toBe(true)
      expect(i18next.exists(`${namespace}.add`)).toBe(true)
      expect(i18next.exists(`${namespace}.remove`)).toBe(true)
    }
  })

  it('gives each half its own glyph', () => {
    expect(NODE_KINDS.mesh.icon).not.toBe(NODE_KINDS.light.icon)
  })
})
