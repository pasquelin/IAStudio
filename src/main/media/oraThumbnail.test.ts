import { describe, expect, it, vi } from 'vitest'
import { pngBytes } from './png-fixtures'
import { oraThumbnailOf } from './oraThumbnail'

/**
 * `nativeImage` needs a live app, which no test has — so the double answers an empty image, and
 * what is asserted here is everything AROUND the decode: which pictures are handed back
 * untouched, and what a decode that gives nothing answers.
 */
vi.mock('electron', () => ({
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) },
}))

const pngOf = (width: number, height: number): Uint8Array => pngBytes({ width, height })

describe('the thumbnail a container carries', () => {
  // The spec caps it at 256 a side. A picture already under that IS its own thumbnail, and
  // re-encoding it could only lose.
  it('hands back a small picture untouched', () => {
    const small = pngOf(200, 120)

    expect(oraThumbnailOf(small)).toBe(small)
  })

  it('keeps a picture that is exactly the ceiling', () => {
    const exact = pngOf(256, 256)

    expect(oraThumbnailOf(exact)).toBe(exact)
  })

  /**
   * The entry is optional, and a thumbnail bigger than the spec allows is worse than none: the
   * flatten used to be written there whole, which doubled every container.
   */
  it('answers nothing rather than a picture it could not reduce', () => {
    expect(oraThumbnailOf(pngOf(4096, 4096))).toBeUndefined()
  })

  it('answers nothing for bytes that are not a PNG', () => {
    expect(oraThumbnailOf(new Uint8Array([1, 2, 3]))).toBeUndefined()
  })
})
