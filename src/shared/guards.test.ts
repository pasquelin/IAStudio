import { describe, expect, it } from 'vitest'
import { isRecord, readBoolean, readNumber, readString } from './guards'

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
