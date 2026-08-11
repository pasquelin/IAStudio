import { describe, expect, it } from 'vitest'
import {
  defined,
  isRecord,
  readBoolean,
  readColor,
  readNumber,
  readPositive,
  readString,
} from './guards'

describe('isRecord', () => {
  it('rejects null, which typeof alone reports as an object', () => {
    expect(isRecord(null)).toBe(false)
  })

  it('accepts a plain object', () => {
    expect(isRecord({ view: 'grid' })).toBe(true)
  })

  it('accepts an array, which carries readable keys', () => {
    expect(isRecord([])).toBe(true)
  })

  it('rejects primitives and undefined', () => {
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord('grid')).toBe(false)
    expect(isRecord(2)).toBe(false)
    expect(isRecord(false)).toBe(false)
  })
})

describe('readNumber', () => {
  it('reads a number that is there', () => {
    expect(readNumber({ fps: 25 }, 'fps', 30)).toBe(25)
    expect(readNumber({ gain: 0 }, 'gain', 3)).toBe(0)
  })

  // `JSON.stringify` writes both as `null`, so a file holding one was unreadable when written.
  it('refuses what arithmetic cannot come back from', () => {
    expect(readNumber({ fps: NaN }, 'fps', 30)).toBe(30)
    expect(readNumber({ fps: Infinity }, 'fps', 30)).toBe(30)
    expect(readNumber({ fps: -Infinity }, 'fps', 30)).toBe(30)
  })

  it('falls back on a value of another type, or on none at all', () => {
    expect(readNumber({ fps: '25' }, 'fps', 30)).toBe(30)
    expect(readNumber({ fps: null }, 'fps', 30)).toBe(30)
    expect(readNumber({}, 'fps', 30)).toBe(30)
  })
})

describe('readString', () => {
  it('reads a string that is there, empty included', () => {
    expect(readString({ name: 'V1' }, 'name', 'track')).toBe('V1')
    expect(readString({ name: '' }, 'name', 'track')).toBe('')
  })

  it('falls back on a value of another type, or on none at all', () => {
    expect(readString({ name: 2 }, 'name', 'track')).toBe('track')
    expect(readString({ name: null }, 'name', 'track')).toBe('track')
    expect(readString({}, 'name', 'track')).toBe('track')
  })
})

describe('readColor', () => {
  it('reads a hexadecimal colour, in either case', () => {
    expect(readColor({ color: '#ffcc88' }, 'color', '#000000')).toBe('#ffcc88')
    expect(readColor({ color: '#FFCC88' }, 'color', '#000000')).toBe('#FFCC88')
  })

  // The one three.js honours and the picker cannot show: `tokenAsHex` reads `#fff` as 0xfff, a
  // dark blue, so a shape the app never writes must not become a colour it never chose.
  it('refuses the three-digit shorthand', () => {
    expect(readColor({ color: '#fff' }, 'color', '#000000')).toBe('#000000')
  })

  // The whole point of the reader: three.js answers an unknown colour by logging and leaving the
  // material as it was, so a document holding one opens on the previous sky rather than its own.
  it('refuses a string that is not a colour at all', () => {
    expect(readColor({ color: 'banana' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'red' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'rgb(255,0,0)' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: '#ff00' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: '#ff000000' }, 'color', '#ffffff')).toBe('#ffffff')
    expect(readColor({ color: 'ffffff' }, 'color', '#ffffff')).toBe('#ffffff')
  })

  // No `g` flag on the pattern: a shared regexp carrying `lastIndex` would answer differently on
  // its second call, and every reader here shares this one.
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

describe('readPositive', () => {
  it('reads a positive number that is there', () => {
    expect(readPositive({ start: 4 }, 'start', 0)).toBe(4)
    expect(readPositive({ start: 0 }, 'start', 9)).toBe(0)
  })

  // A negative length, a negative point in time: the file is user territory, and every caller
  // of this reads a value that has no meaning below zero.
  it('floors a negative value rather than passing it on', () => {
    expect(readPositive({ start: -4 }, 'start', 0)).toBe(0)
  })

  // The fallback goes through the same floor: a caller that names a negative default is asking
  // for something this function exists to refuse.
  it('floors the fallback too', () => {
    expect(readPositive({}, 'start', -4)).toBe(0)
  })

  it('falls back on a value of another type, or on none at all', () => {
    expect(readPositive({ start: 'soon' }, 'start', 7)).toBe(7)
    expect(readPositive({ start: Number.NaN }, 'start', 7)).toBe(7)
    expect(readPositive({}, 'start', 7)).toBe(7)
  })
})

describe('readBoolean', () => {
  it('reads a boolean that is there', () => {
    expect(readBoolean({ muted: true }, 'muted', false)).toBe(true)
    expect(readBoolean({ muted: false }, 'muted', true)).toBe(false)
  })

  // Truthiness is not the question: a stored `1` says nothing about a track being muted, and a
  // setting whose default is `true` must not be turned off by a value nobody wrote.
  it('falls back on anything that is not a boolean', () => {
    expect(readBoolean({ muted: 1 }, 'muted', false)).toBe(false)
    expect(readBoolean({ muted: 'true' }, 'muted', false)).toBe(false)
    expect(readBoolean({ shown: null }, 'shown', true)).toBe(true)
    expect(readBoolean({}, 'shown', true)).toBe(true)
  })
})

describe('defined', () => {
  it('drops the keys whose value is undefined', () => {
    expect(defined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' })
  })

  it('keeps a value that is falsy but present', () => {
    // `0`, `''` and `false` are answers; only `undefined` is the absence of one.
    expect(defined({ a: 0, b: '', c: false, d: null })).toEqual({ a: 0, b: '', c: false, d: null })
  })

  it('answers an empty object when nothing is defined', () => {
    expect(defined({ a: undefined })).toEqual({})
  })
})
