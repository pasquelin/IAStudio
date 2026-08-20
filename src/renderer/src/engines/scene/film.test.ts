import { describe, expect, it } from 'vitest'
import { SECOND, frameDuration } from '@shared/domain/time'
import { evenSize, flipRows, flipToSrgbInto, frameTimes } from './film'

describe('the schedule of a film', () => {
  it('starts at zero and steps by one frame', () => {
    expect(frameTimes(0.2 * SECOND, 25)).toEqual([0, 40_000, 80_000, 120_000, 160_000])
  })

  it('counts rather than accumulates, so a long film does not drift', () => {
    const times = frameTimes(100 * SECOND, 30)
    expect(times).toHaveLength(3000)
    // Accumulated, the last instant would land measurably past where it belongs. In whole
    // microseconds it is not merely close to the right frame, it IS that frame.
    expect(times.at(-1)).toBe(2999 * frameDuration(30))
  })

  it('rounds up, so the last moment of the timeline is shown rather than cut', () => {
    expect(frameTimes(0.1 * SECOND, 25)).toHaveLength(3)
  })

  it('answers nothing for a film with no length or no rate', () => {
    expect(frameTimes(0, 25)).toEqual([])
    expect(frameTimes(5 * SECOND, 0)).toEqual([])
    expect(frameTimes(-1 * SECOND, 25)).toEqual([])
  })

  it('still gives one frame to a film shorter than one', () => {
    expect(frameTimes(0.001, 25)).toHaveLength(1)
  })
})

describe('the pixels that come back', () => {
  /** Two rows of two pixels, the top one red and the bottom one blue, as WebGL hands them over. */
  const bottomUp = new Uint8Array([0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255])

  it('turns a bottom-up read into a top-down image', () => {
    const flipped = flipRows(bottomUp, 2, 2)

    // The first row of the image is now the red one, which WebGL had handed over last.
    expect([...flipped.slice(0, 4)]).toEqual([255, 0, 0, 255])
    expect([...flipped.slice(12, 16)]).toEqual([0, 0, 255, 255])
  })

  it('keeps every byte it was given', () => {
    expect(flipRows(bottomUp, 2, 2)).toHaveLength(bottomUp.length)
  })

  it('leaves a single row exactly as it was', () => {
    const row = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...flipRows(row, 2, 1)]).toEqual([...row])
  })
})

/**
 * A render target holds LINEAR pixels whatever its texture says — see `flipToSrgbInto`. What is
 * under test is that a still comes out of the same door a screen does, not washed out.
 */
describe('a still read back out of a render target', () => {
  const encoded = (linear: number): number => {
    const into = new Uint8ClampedArray(4)
    flipToSrgbInto(into, new Uint8Array([linear, linear, linear, 128]), 1, 1)
    return into[0] ?? 0
  }

  it('lifts the mid-tones, which is the whole of the correction', () => {
    // Mid grey in linear light is far brighter once encoded: 128 → 188, not 128.
    expect(encoded(128)).toBe(188)
  })

  it('leaves black and white where they are', () => {
    expect(encoded(0)).toBe(0)
    expect(encoded(255)).toBe(255)
  })

  it('never touches the alpha, which is linear by definition', () => {
    const into = new Uint8ClampedArray(4)
    flipToSrgbInto(into, new Uint8Array([10, 20, 30, 128]), 1, 1)
    expect(into[3]).toBe(128)
  })

  it('turns the rows over like the plain flip does', () => {
    const into = new Uint8ClampedArray(16)
    // A blue row, then a red one — the order WebGL hands them back in.
    const bottomUpRows = new Uint8Array([
      0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    ])
    flipToSrgbInto(into, bottomUpRows, 2, 2)

    expect(into[0]).toBe(255)
    expect(into[10]).toBe(255)
  })
})

describe('the size a film is written at', () => {
  it('rounds to even, which every H.264 encoder requires', () => {
    expect(evenSize({ width: 1921, height: 1081, fps: 25, duration: 1 })).toEqual({
      width: 1922,
      height: 1082,
    })
  })

  it('never falls below one even pixel', () => {
    expect(evenSize({ width: 0, height: 1, fps: 25, duration: 1 })).toEqual({
      width: 2,
      height: 2,
    })
  })

  it('leaves an even size alone', () => {
    expect(evenSize({ width: 1920, height: 1080, fps: 25, duration: 1 })).toEqual({
      width: 1920,
      height: 1080,
    })
  })
})
