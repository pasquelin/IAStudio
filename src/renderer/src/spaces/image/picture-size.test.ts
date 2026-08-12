import { describe, expect, it } from 'vitest'
import { measureAsset, MAX_PICTURE_SIDE, withinCeiling } from './picture-size'

describe('bringing a picture under the ceiling', () => {
  it('leaves one that already fits exactly as it is', () => {
    expect(withinCeiling({ width: 4096, height: 2048 })).toEqual({ width: 4096, height: 2048 })
  })

  /**
   * A surface is document-sized and there is one per layer, so an unbounded picture asks the GPU
   * for hundreds of megabytes before the second layer exists.
   */
  it('scales the longest side down to the ceiling', () => {
    const capped = withinCeiling({ width: MAX_PICTURE_SIDE * 2, height: MAX_PICTURE_SIDE })

    expect(capped.width).toBe(MAX_PICTURE_SIDE)
  })

  // The document IS the picture here, so letterboxing would put the bars in the pixels.
  it('keeps the shape while it does so', () => {
    const capped = withinCeiling({ width: 20000, height: 10000 })

    expect(capped.width / capped.height).toBeCloseTo(2)
  })

  // A short side that rounds to zero leaves no surface to paint on at all.
  it('never rounds a side away entirely', () => {
    expect(withinCeiling({ width: 100000, height: 3 }).height).toBeGreaterThanOrEqual(1)
  })
})

describe('measuring an asset', () => {
  it('answers what the picture measures', async () => {
    const measured = await measureAsset('asset-1', () => Promise.resolve({ width: 8, height: 4 }))

    expect(measured).toEqual({ width: 8, height: 4 })
  })

  // Refusing to answer is what makes ⌘S decline to overwrite: doubt falls on the safe side.
  it('answers nothing for a picture that will not decode', async () => {
    await expect(
      measureAsset('asset-1', () => Promise.reject(new Error('gone'))),
    ).resolves.toBeNull()
  })

  // jsdom hands back zeros rather than throwing, which is not a measurement either.
  it('answers nothing for a picture that measures nothing', async () => {
    const measured = await measureAsset('asset-1', () => Promise.resolve({ width: 0, height: 0 }))

    expect(measured).toBeNull()
  })
})
