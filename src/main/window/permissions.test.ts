import { describe, expect, it } from 'vitest'
import { grantsPermission, originOf } from './permissions'

describe('grantsPermission', () => {
  it('grants the microphone to the application itself', () => {
    expect(grantsPermission({ permission: 'media', origin: 'app://studio' }, 'app://studio')).toBe(
      true,
    )
  })

  // Electron grants everything when no handler is installed, which is what this replaces.
  it('refuses the microphone to any other origin', () => {
    expect(
      grantsPermission({ permission: 'media', origin: 'https://example.test' }, 'app://studio'),
    ).toBe(false)
  })

  it('refuses every permission the studio never asks for', () => {
    for (const permission of ['geolocation', 'notifications', 'midi', 'clipboard-read']) {
      expect(grantsPermission({ permission, origin: 'app://studio' }, 'app://studio')).toBe(false)
    }
  })
})

describe('originOf', () => {
  it('keeps the origin of a served page', () => {
    expect(originOf('http://localhost:5173/index.html#settings')).toBe('http://localhost:5173')
  })

  // A packaged build loads from disk, where every page reports the opaque origin — so that is
  // what the two sides compare, and `'null'` is the right answer rather than a failure.
  it('answers null for a file URL, as the platform does', () => {
    expect(originOf('file:///Applications/Studio.app/out/renderer/index.html')).toBe('null')
  })

  it('answers null for something that is not a URL at all', () => {
    expect(originOf('')).toBe('null')
  })
})
