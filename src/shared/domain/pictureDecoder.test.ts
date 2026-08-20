import { describe, expect, it } from 'vitest'
import { decoderFor } from './pictureDecoder'

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('which decoder a picture needs', () => {
  it('reads an OpenEXR by the four bytes it opens on', () => {
    expect(decoderFor(new Uint8Array([0x76, 0x2f, 0x31, 0x01, 0, 0]))).toBe('openexr')
  })

  it('reads both lines a Radiance file opens on', () => {
    expect(decoderFor(bytesOf('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n'))).toBe('radiance')
    expect(decoderFor(bytesOf('#?RGBE\nFORMAT=32-bit_rle_rgbe\n'))).toBe('radiance')
  })

  /** A scanner writes one byte order and a phone the other; both are TIFF and neither decodes. */
  it('reads a TIFF written either way round', () => {
    expect(decoderFor(new Uint8Array([0x49, 0x49, 0x2a, 0x00]))).toBe('tiff')
    expect(decoderFor(new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]))).toBe('tiff')
  })

  it('answers nothing for the pictures a browser decodes on its own', () => {
    expect(decoderFor(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(decoderFor(bytesOf('<svg width="10">'))).toBeNull()
    expect(decoderFor(new Uint8Array(0))).toBeNull()
  })
})
