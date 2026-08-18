import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { clipLabel } from './clipLabel'

// This suite runs in the node project, where no bundle is loaded: the key and its number are
// echoed so that WHICH label was chosen is what the assertions read.
const t = ((key: string, values?: { number: number }) =>
  values ? `${key}:${values.number}` : key) as unknown as TFunction

describe('clipLabel', () => {
  it('keeps a name the file actually chose', () => {
    expect(clipLabel('Walking', t)).toBe('Walking')
  })

  // MEASURED on the issue's three files: Tripo writes `NlaTrack`, and Uthana writes no name at
  // all — `GLTFLoader` then numbers it `animation_0`.
  it('replaces the name a Blender export left behind', () => {
    expect(clipLabel('NlaTrack', t)).toBe('inspector.clipUnnamed')
  })

  it('numbers a clip the file never named, from one rather than from zero', () => {
    expect(clipLabel('animation_0', t)).toBe('inspector.clipNumbered:1')
    expect(clipLabel('animation_11', t)).toBe('inspector.clipNumbered:12')
  })

  it('leaves a name that merely starts the same way alone', () => {
    expect(clipLabel('animation_final', t)).toBe('animation_final')
    expect(clipLabel('NlaTrack of mine', t)).toBe('NlaTrack of mine')
  })
})
