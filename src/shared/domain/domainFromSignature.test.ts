import { describe, expect, it } from 'vitest'
import { domainFromSignature, SIGNATURE_BYTES } from './domainFromSignature'

const header = (...parts: (string | number)[]): Uint8Array => {
  const bytes = new Uint8Array(SIGNATURE_BYTES)
  let at = 0

  for (const part of parts) {
    if (typeof part === 'number') {
      bytes[at++] = part
      continue
    }
    for (const character of part) bytes[at++] = character.charCodeAt(0)
  }

  return bytes
}

describe('domainFromSignature', () => {
  it('reads a picture off its first bytes', () => {
    expect(domainFromSignature(header(0x89, 'PNG'))).toBe('image')
    expect(domainFromSignature(header(0xff, 0xd8, 0xff))).toBe('image')
    expect(domainFromSignature(header('GIF89a'))).toBe('image')
    expect(domainFromSignature(header('<svg xmlns='))).toBe('image')
  })

  it('reads a sound, a take and a model', () => {
    expect(domainFromSignature(header('fLaC'))).toBe('audio')
    expect(domainFromSignature(header('ID3'))).toBe('audio')
    expect(domainFromSignature(header(0x1a, 0x45, 0xdf, 0xa3))).toBe('video')
    expect(domainFromSignature(header('glTF'))).toBe('mesh')
  })

  it('tells the two RIFF containers apart by their second word', () => {
    expect(domainFromSignature(header('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image')
    expect(domainFromSignature(header('RIFF', 0, 0, 0, 0, 'WAVE'))).toBe('audio')
  })

  it('tells an ISO container apart by its brand, and falls back to a take', () => {
    expect(domainFromSignature(header(0, 0, 0, 0x20, 'ftypavif'))).toBe('image')
    expect(domainFromSignature(header(0, 0, 0, 0x20, 'ftypM4A '))).toBe('audio')
    expect(domainFromSignature(header(0, 0, 0, 0x20, 'ftypisom'))).toBe('video')
    expect(domainFromSignature(header(0, 0, 0, 0x20, 'ftypqt  '))).toBe('video')
  })

  it('answers nothing for bytes it does not know', () => {
    expect(domainFromSignature(header('hello, this is prose'))).toBeNull()
    expect(domainFromSignature(new Uint8Array(0))).toBeNull()
  })
})
