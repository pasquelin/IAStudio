import { describe, expect, it } from 'vitest'
import { HEX_COLOR, readColor } from './color'

describe('readColor', () => {
  it('reads a hexadecimal colour, in either case', () => {
    expect(readColor({ color: '#ffcc88' }, 'color', '#000000')).toBe('#ffcc88')
    expect(readColor({ color: '#FFCC88' }, 'color', '#000000')).toBe('#FFCC88')
  })

  /*
   * All four render, and Chromium normalises all four in the swatch — measured, and it is why
   * this is a consistency rule rather than a rescue. Refused so that the file, the control and
   * the render carry one spelling: `red` in state against `#ff0000` in the control is one colour
   * under two strings, and nothing downstream compares them as colours.
   */
  it('refuses a colour written in another notation', () => {
    expect(readColor({ color: '#fff' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'red' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'rgb(255,0,0)' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'hsl(0,100%,50%)' }, 'color', '#ffffff')).toBe('#ffffff')
  })

  // The class three.js refuses outright: `Color.set` logs and leaves the material at whatever
  // colour it already had, which is the one case with nothing on screen to report it.
  it('refuses a string that is no colour to anyone', () => {
    expect(readColor({ color: 'banana' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'ffffff' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: '#ff00' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: '#ff000000' }, 'color', '#ffffff')).toBe('#ffffff')
  })

  // No `g` flag: `lastIndex` would run past a seven-character string and the second call would
  // answer the fallback. Shared by three readers, so it is asked twice in the same frame.
  it('answers the same on a second call', () => {
    expect(readColor({ color: '#123456' }, 'color', '#000000')).toBe('#123456')
    expect(readColor({ color: '#123456' }, 'color', '#000000')).toBe('#123456')
  })

  it('falls back on a value of another type, or on none at all', () => {
    expect(readColor({ color: 2 }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: null }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({}, 'color', '#ffffff')).toBe('#ffffff')
  })
})

describe('HEX_COLOR', () => {
  /*
   * Both ends, and each end needs its own case: every string that fails the tail also fails the
   * head, so a test built on trailing rubbish alone leaves `^` free to be dropped. It was — the
   * first version of this file asserted `'#ffcc88 and more'` and `'rgb(#ffcc88)'`, and removing
   * `^` kept all 7036 tests green.
   */
  it('refuses a colour with anything BEFORE it', () => {
    expect(HEX_COLOR.test('url(#ff0000')).toBe(false)
    expect(HEX_COLOR.test(' #ff0000')).toBe(false)
    expect(HEX_COLOR.test('red#ff0000')).toBe(false)
    expect(HEX_COLOR.test('\n#ff0000')).toBe(false)
  })

  it('refuses a colour with anything AFTER it', () => {
    expect(HEX_COLOR.test('#ffcc88 and more')).toBe(false)
    expect(HEX_COLOR.test('#ffcc8899')).toBe(false)
  })

  // The shape is read by zod in the main process as well as by the readers here: a `g` would
  // widen both at once, and asymmetrically — only the second call of each pair.
  it('carries no flag but case-insensitivity', () => {
    expect(HEX_COLOR.flags).toBe('i')
  })
})
