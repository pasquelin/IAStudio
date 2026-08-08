import { describe, expect, it } from 'vitest'
import { MESH_ENTRIES } from '@shared/domain/scene'
import { MESH_PRIMITIVES, primitiveByKind } from './mesh-primitives'

describe('MESH_PRIMITIVES', () => {
  it('declares each kind exactly once', () => {
    const kinds = MESH_PRIMITIVES.map(primitive => primitive.kind)
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('gives every entry an icon', () => {
    for (const primitive of MESH_PRIMITIVES) expect(primitive.icon.length).toBeGreaterThan(0)
  })

  // Two entries sharing an icon make the list unreadable, which is all it is asked to be.
  it('never reuses an icon', () => {
    const icons = MESH_PRIMITIVES.map(primitive => primitive.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it('builds a descriptor whose kind matches its entry', () => {
    for (const primitive of MESH_PRIMITIVES) {
      if (!primitive.create) continue
      expect(primitive.create().kind).toBe(primitive.kind)
    }
  })

  // Announced rather than hidden: the menu says what is coming instead of pretending.
  // A sprite and a 3D text are node types of their own, not geometries: they left this table.
  it('gives every primitive it declares a builder', () => {
    expect(MESH_PRIMITIVES.filter(primitive => !primitive.create)).toEqual([])
  })

  it('returns a fresh descriptor on every call', () => {
    const box = primitiveByKind('box')
    expect(box?.create?.()).not.toBe(box?.create?.())
  })

  it('returns null for an unknown kind', () => {
    expect(primitiveByKind('teapot')).toBeNull()
  })

  /**
   * The native menu greys from the shared flag and cannot see the builders; the in-app menus
   * grey from `disabled`. Let the two drift and a primitive is offered in one and not the
   * other, with nothing failing to compile.
   */
  it('greys exactly what the shared table declares as not offered yet', () => {
    const declared = MESH_ENTRIES.filter(entry => entry.disabled).map(entry => entry.kind)
    const built = MESH_PRIMITIVES.filter(primitive => primitive.disabled).map(
      primitive => primitive.kind,
    )
    expect(built).toEqual(declared)
  })
})
