import { describe, expect, it } from 'vitest'
import { LIGHT_TYPES, lightByKind } from './light-types'

describe('LIGHT_TYPES', () => {
  // The order is locked because `createDefaultScene` reads the registry by kind, and the menu
  // and the toolbar both render it as declared.
  it('declares the five editor lights, each once', () => {
    expect(LIGHT_TYPES.map(light => light.kind)).toEqual([
      'ambient',
      'directional',
      'hemisphere',
      'point',
      'spot',
    ])
  })

  it('builds a descriptor whose kind matches its entry', () => {
    for (const light of LIGHT_TYPES) expect(light.create().kind).toBe(light.kind)
  })

  it('gives every entry a label key and an icon', () => {
    for (const light of LIGHT_TYPES) {
      expect(light.labelKey).toMatch(/^lights\./)
      expect(light.icon.length).toBeGreaterThan(0)
    }
  })

  it('never reuses an icon', () => {
    const icons = LIGHT_TYPES.map(light => light.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it('returns a fresh descriptor on every call', () => {
    const ambient = lightByKind('ambient')
    expect(ambient?.create()).not.toBe(ambient?.create())
  })

  it('returns null for an unknown kind', () => {
    expect(lightByKind('laser')).toBeNull()
  })
})
