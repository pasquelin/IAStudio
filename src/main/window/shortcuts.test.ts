import { describe, expect, it } from 'vitest'
import { isReloadShortcut, type KeyPress } from './shortcuts'

const press = (overrides: Partial<KeyPress> = {}): KeyPress => ({
  type: 'keyDown',
  key: 'a',
  control: false,
  meta: false,
  alt: false,
  ...overrides,
})

describe('isReloadShortcut', () => {
  it('catches the reload the navigation lock lets through', () => {
    expect(isReloadShortcut(press({ key: 'r', meta: true }))).toBe(true)
    expect(isReloadShortcut(press({ key: 'r', control: true }))).toBe(true)
    expect(isReloadShortcut(press({ key: 'F5' }))).toBe(true)
  })

  it('ignores the letter without a modifier, so typing stays possible', () => {
    expect(isReloadShortcut(press({ key: 'r' }))).toBe(false)
  })

  it('ignores key releases, which would otherwise fire the check twice', () => {
    expect(isReloadShortcut(press({ type: 'keyUp', key: 'r', meta: true }))).toBe(false)
  })

  it('is case-insensitive, since Shift changes the reported key', () => {
    expect(isReloadShortcut(press({ key: 'R', meta: true }))).toBe(true)
  })

  it('lets AltGr+R through, which types a character on several layouts', () => {
    // Windows reports AltGr as Ctrl+Alt. Swallowing it would break Polish, Hungarian and
    // Croatian keyboards in the packaged build.
    expect(isReloadShortcut(press({ key: 'r', control: true, alt: true }))).toBe(false)
  })
})
