import { describe, expect, it } from 'vitest'
import { gestureOf } from './gestures'

const LEFT = { button: 0, altKey: false, shiftKey: false }
const MIDDLE = { button: 1, altKey: false, shiftKey: false }
const RIGHT = { button: 2, altKey: false, shiftKey: false }

describe('what a button asks the view to do', () => {
  it('orbits on alt and the left button, as Unity, Unreal and Maya all do', () => {
    expect(gestureOf({ ...LEFT, altKey: true })).toBe('orbit')
  })

  it('pans on the middle button, as Unity, Unreal, Maya and Godot all do', () => {
    expect(gestureOf(MIDDLE)).toBe('pan')
  })

  it('pans on shift, alt and the left button — the trackpad, which has no middle button', () => {
    expect(gestureOf({ button: 0, altKey: true, shiftKey: true })).toBe('pan')
  })

  it('leaves the right button alone, the flight owning it and the menu after it', () => {
    expect(gestureOf(RIGHT)).toBeNull()
    expect(gestureOf({ ...RIGHT, altKey: true })).toBeNull()
  })

  /**
   * The one deviation, and it is transitional: Unity and Blender draw a selection rectangle here,
   * Unreal dollies. Until a rectangle exists, a bare drag that did nothing would match nobody.
   */
  it('still orbits on a bare left drag, until a selection rectangle takes that gesture', () => {
    expect(gestureOf(LEFT)).toBe('orbit')
  })

  it('orbits under the keys that extend a selection, which no longer pan', () => {
    expect(gestureOf({ ...LEFT, shiftKey: true })).toBe('orbit')
  })
})
