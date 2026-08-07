import { describe, expect, it } from 'vitest'
import { isRecord } from './guards'

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
