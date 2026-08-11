import { describe, expect, it } from 'vitest'
import { HEX_COLOR, readColor } from './color'

describe('readColor', () => {
  it('reads a hexadecimal colour, in either case', () => {
    expect(readColor({ color: '#ffcc88' }, 'color', '#000000')).toBe('#ffcc88')
    expect(readColor({ color: '#FFCC88' }, 'color', '#000000')).toBe('#FFCC88')
  })

  /*
   * These four are colours to three.js — `red`, `rgb()` and `#fff` all render — and none of them
   * survives `<input type="color">`, which answers `#000000` for each. Refusing them is what
   * keeps the swatch, the text beside it and the render saying the same thing.
   */
  it('refuses a colour the picker could not show', () => {
    expect(readColor({ color: '#fff' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'red' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'rgb(255,0,0)' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'hsl(0,100%,50%)' }, 'color', '#ffffff')).toBe('#ffffff')
  })

  // And the ones three.js refuses too, where it logs and leaves the material as it was.
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
  // The shape is read by zod in the main process as well as by the readers here, and a `g` or a
  // missing anchor would widen both at once.
  it('anchors both ends, so a colour cannot merely contain one', () => {
    expect(HEX_COLOR.test('#ffcc88 and more')).toBe(false)
    expect(HEX_COLOR.test('rgb(#ffcc88)')).toBe(false)
    expect(HEX_COLOR.flags).toBe('i')
  })
})
