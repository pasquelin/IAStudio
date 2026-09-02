import { describe, expect, it } from 'vitest'
import { SCHEME_OF, type DeclaredPreset } from '@shared/domain/navigationPreset'
import { gestureOf } from './gestures'

const LEFT = { button: 0, altKey: false, shiftKey: false }
const MIDDLE = { button: 1, altKey: false, shiftKey: false }
const RIGHT = { button: 2, altKey: false, shiftKey: false }

/** Every preset but the studio's, whose bare left drag is its own — see the cases below. */
const OTHERS: readonly DeclaredPreset[] = ['unreal', 'unity', 'blender', 'roblox']
const PANNERS: readonly DeclaredPreset[] = ['studio', 'unreal', 'unity', 'roblox']
const ALT_ORBITERS: readonly DeclaredPreset[] = ['unreal', 'unity', 'roblox']

const studio = (over = {}) => gestureOf({ ...LEFT, ...over }, SCHEME_OF.studio)

describe('what a button asks the view to do, in the studio', () => {
  it('orbits on alt and the left button, as Unity, Unreal and Maya all do', () => {
    expect(studio({ altKey: true })).toBe('orbit')
  })

  it('pans on the middle button, as Unity, Unreal, Maya and Godot all do', () => {
    expect(studio(MIDDLE)).toBe('pan')
  })

  it('pans on shift, alt and the left button — the trackpad, which has no middle button', () => {
    expect(studio({ altKey: true, shiftKey: true })).toBe('pan')
  })

  it('leaves the right button alone, the flight owning it and the menu after it', () => {
    expect(studio(RIGHT)).toBeNull()
    expect(studio({ ...RIGHT, altKey: true })).toBeNull()
  })

  /**
   * The one deviation, and it is transitional: Unity and Blender draw a selection rectangle here,
   * Unreal dollies. Until a rectangle exists, a bare drag that did nothing would match nobody.
   */
  it('still orbits on a bare left drag, until a selection rectangle takes that gesture', () => {
    expect(studio()).toBe('orbit')
  })

  it('orbits under the keys that extend a selection, which no longer pan', () => {
    expect(studio({ shiftKey: true })).toBe('orbit')
  })

  /**
   * Swallowed, a press takes `⌥`-click and `⌥⇧`-click on a rail with it — both decided on
   * RELEASE, from a press the picking has to have seen.
   */
  it('names a gesture without claiming the press, the picking deciding on release', () => {
    expect(studio({ altKey: true })).toBe('orbit')
  })
})

describe('what a button asks the view to do, under another application', () => {
  /** The one that orbits on the MIDDLE button, where the other three pan with it. */
  it('orbits on the middle button under Blender, and pans on shift with it', () => {
    expect(gestureOf(MIDDLE, SCHEME_OF.blender)).toBe('orbit')
    expect(gestureOf({ ...MIDDLE, shiftKey: true }, SCHEME_OF.blender)).toBe('pan')
  })

  /** And the middle button pans everywhere else — the reading that separates the two families. */
  it.each(PANNERS)('pans on the middle button under %s', preset => {
    expect(gestureOf(MIDDLE, SCHEME_OF[preset])).toBe('pan')
  })

  /**
   * A bare left drag is the studio's alone. Unity and Blender draw a rectangle with it and Unreal
   * dollies, so under those three it must reach the picking untouched.
   */
  it.each(OTHERS)('leaves a bare left drag free under %s', preset => {
    expect(gestureOf(LEFT, SCHEME_OF[preset])).toBeNull()
  })

  it.each(ALT_ORBITERS)('orbits on alt and the left button under %s', preset => {
    expect(gestureOf({ ...LEFT, altKey: true }, SCHEME_OF[preset])).toBe('orbit')
  })

  it('reads a chord before the bare button it is built on', () => {
    expect(gestureOf({ ...MIDDLE, altKey: true }, SCHEME_OF.unity)).toBe('pan')
  })
})
