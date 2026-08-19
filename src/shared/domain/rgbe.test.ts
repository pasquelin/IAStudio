import { describe, expect, it } from 'vitest'
import { encodeRgbe } from './rgbe'

/** What the four bytes of one pixel decode back to — the reader's half of the format. */
function decoded(file: Uint8Array, at: number): [number, number, number] {
  const exponent = file[at + 3] ?? 0
  if (exponent === 0) return [0, 0, 0]

  const scale = Math.pow(2, exponent - 128) / 256
  return [(file[at] ?? 0) * scale, (file[at + 1] ?? 0) * scale, (file[at + 2] ?? 0) * scale]
}

const bodyAt = (file: Uint8Array): number => file.indexOf(0x0a, file.indexOf(0x59)) + 1

describe('a Radiance file', () => {
  it('opens on the two lines every reader looks for', () => {
    const header = new TextDecoder().decode(encodeRgbe(new Float32Array(4), 1, 1).subarray(0, 64))

    expect(header).toContain('#?RADIANCE')
    expect(header).toContain('FORMAT=32-bit_rle_rgbe')
    expect(header).toContain('-Y 1 +X 1')
  })

  it('is four bytes a pixel after its header, and nothing more', () => {
    const file = encodeRgbe(new Float32Array(4 * 6), 3, 2)

    expect(file.length - bodyAt(file)).toBe(3 * 2 * 4)
  })

  /**
   * The whole point of the format: a value far past one survives, where eight bits a channel
   * would have clipped it to white.
   */
  it('carries a value no ordinary picture could hold', () => {
    const file = encodeRgbe(new Float32Array([12, 6, 3, 1]), 1, 1)

    const [red, green, blue] = decoded(file, bodyAt(file))
    expect(red).toBeCloseTo(12, 1)
    expect(green).toBeCloseTo(6, 1)
    expect(blue).toBeCloseTo(3, 1)
  })

  it('keeps the ratio between channels, which is what a colour is', () => {
    const file = encodeRgbe(new Float32Array([0.5, 0.25, 0.125, 1]), 1, 1)

    const [red, green, blue] = decoded(file, bodyAt(file))
    expect(green / red).toBeCloseTo(0.5, 2)
    expect(blue / red).toBeCloseTo(0.25, 2)
  })

  it('spells black as the four zeros the format reserves for it', () => {
    const file = encodeRgbe(new Float32Array([0, 0, 0, 1]), 1, 1)

    expect([...file.subarray(bodyAt(file))]).toEqual([0, 0, 0, 0])
  })

  /** A NaN written raw makes a file no reader recovers from — it lands as black instead. */
  it('writes black rather than a value that is not one', () => {
    const file = encodeRgbe(new Float32Array([Number.NaN, Number.NaN, Number.NaN, 1]), 1, 1)

    expect([...file.subarray(bodyAt(file))]).toEqual([0, 0, 0, 0])
  })

  /**
   * The defect a viewer shows and no other assertion would: a render target reads back with row
   * zero at the BOTTOM, and `-Y` says the file starts at the top.
   */
  it('writes the rows the way up the header says, not the way the GPU reads them', () => {
    const bottomRowIsBright = new Float32Array([4, 4, 4, 1, 0, 0, 0, 1])

    const file = encodeRgbe(bottomRowIsBright, 1, 2)

    const [first] = decoded(file, bodyAt(file))
    expect(first).toBe(0)
    expect(decoded(file, bodyAt(file) + 4)[0]).toBeCloseTo(4, 1)
  })
})
