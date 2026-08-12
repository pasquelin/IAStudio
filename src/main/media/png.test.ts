import { describe, expect, it } from 'vitest'
import { isPngBytes, probePng } from './png'

/** A PNG opening: the eight-byte signature, then an IHDR chunk carrying the two dimensions. */
function png(options: { width: number; height: number; trailing?: number }): Uint8Array {
  const bytes = new ArrayBuffer(24 + (options.trailing ?? 0))
  const view = new DataView(bytes)
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  signature.forEach((byte, index) => view.setUint8(index, byte))

  view.setUint32(8, 13)
  ;[0x49, 0x48, 0x44, 0x52].forEach((byte, index) => view.setUint8(12 + index, byte))
  view.setUint32(16, options.width)
  view.setUint32(20, options.height)

  return new Uint8Array(bytes)
}

describe('isPngBytes', () => {
  it('accepts the eight-byte signature', () => {
    expect(isPngBytes(png({ width: 1, height: 1 }))).toBe(true)
  })

  it('rejects bytes that open on anything else', () => {
    expect(isPngBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe(false)
  })

  it('rejects bytes too short to carry the signature', () => {
    expect(isPngBytes(new Uint8Array([0x89, 0x50]))).toBe(false)
  })
})

describe('probePng', () => {
  it('reads the dimensions off the IHDR', () => {
    expect(probePng(png({ width: 4112, height: 2658 }))).toEqual({
      duration: 0,
      codec: 'png',
      width: 4112,
      height: 2658,
    })
  })

  it('reads a picture whose bytes carry more chunks after the header', () => {
    expect(probePng(png({ width: 16, height: 9, trailing: 4096 }))?.width).toBe(16)
  })

  it('answers null for bytes that are not a PNG', () => {
    expect(probePng(new Uint8Array(24))).toBeNull()
  })

  it('answers null for bytes too short to hold an IHDR', () => {
    expect(probePng(png({ width: 8, height: 8 }).slice(0, 20))).toBeNull()
  })

  it('answers null when a dimension reads zero, which no picture has', () => {
    expect(probePng(png({ width: 0, height: 12 }))).toBeNull()
  })

  it('answers null when the chunk after the signature is not the header', () => {
    const bytes = png({ width: 4, height: 4 })
    bytes[12] = 0x50
    expect(probePng(bytes)).toBeNull()
  })
})
