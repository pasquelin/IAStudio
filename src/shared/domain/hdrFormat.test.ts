import { describe, expect, it } from 'vitest'
import { hdrFormatOf } from './hdrFormat'

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('which high dynamic range picture a file is', () => {
  it('reads an OpenEXR by the four bytes it opens on', () => {
    expect(hdrFormatOf(new Uint8Array([0x76, 0x2f, 0x31, 0x01, 0, 0]))).toBe('openexr')
  })

  it('reads both lines a Radiance file opens on', () => {
    expect(hdrFormatOf(bytesOf('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n'))).toBe('radiance')
    expect(hdrFormatOf(bytesOf('#?RGBE\nFORMAT=32-bit_rle_rgbe\n'))).toBe('radiance')
  })

  it('answers nothing for the pictures a browser decodes on its own', () => {
    expect(hdrFormatOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(hdrFormatOf(bytesOf('<svg width="10">'))).toBeNull()
    expect(hdrFormatOf(new Uint8Array(0))).toBeNull()
  })
})
