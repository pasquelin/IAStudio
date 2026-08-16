import { describe, expect, it } from 'vitest'
import { HIGHEST_HZ, LOWEST_HZ, spectrumBands, spectrumFraction, SPECTRUM_MARKS } from './spectrum'

/** An analyser reading of 1024 bins over 48 kHz, so a bin is a shade over 23 Hz. */
const RATE = 48_000
const BINS = 1024

const quiet = () => new Uint8Array(BINS)

/** One bin lit, at the frequency asked for. */
const tone = (hz: number, loudness = 255): Uint8Array => {
  const bins = quiet()
  bins[Math.round(hz / (RATE / 2 / BINS))] = loudness
  return bins
}

describe('folding an analyser into bars', () => {
  it('covers the range a montage is judged in, from its low edge to its high one', () => {
    const bars = spectrumBands(quiet(), RATE, 24)

    expect(bars).toHaveLength(24)
    expect(bars[0]?.from).toBeCloseTo(LOWEST_HZ, 4)
    expect(bars.at(-1)?.from).toBeLessThan(HIGHEST_HZ)
  })

  /**
   * Spread by octave, not by hertz: an FFT gives half its bins to the top octave alone, and read
   * evenly a whole mix would crowd into the first two bars.
   */
  it('gives every bar the same musical width, so a bass note is as wide as a cymbal', () => {
    const bars = spectrumBands(quiet(), RATE, 12)
    const ratios = bars.slice(1).map((bar, index) => bar.from / (bars[index]?.from ?? 1))

    for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios[0] ?? 0, 6)
  })

  it('puts a tone in the bar that covers it, and leaves the others quiet', () => {
    const bars = spectrumBands(tone(1_000), RATE, 12)
    const lit = bars.filter(bar => bar.level > 0)

    expect(lit).toHaveLength(1)
    expect(lit[0]?.from).toBeLessThanOrEqual(1_000)
  })

  /**
   * The loudest bin a bar spans, never their average: the top bars span hundreds of bins, and
   * averaging would fade out exactly the bars covering the most ground.
   */
  it('keeps the loudest bin of a bar rather than watering it down', () => {
    const bins = tone(9_000)
    expect(spectrumBands(bins, RATE, 12).find(bar => bar.level > 0)?.level).toBe(1)
  })

  /**
   * The lowest bars are narrower than one bin. Rounded away, the register a montage is usually
   * loudest in would read as silence.
   */
  it('still covers a bar narrower than a single bin', () => {
    const bars = spectrumBands(tone(LOWEST_HZ + 5), RATE, 48)

    expect(bars.some(bar => bar.level > 0)).toBe(true)
  })

  it('has nothing to fold when the analyser gave nothing', () => {
    expect(spectrumBands(new Uint8Array(), RATE, 12)).toEqual([])
    expect(spectrumBands(quiet(), RATE, 0)).toEqual([])
  })
})

describe('the frequency scale', () => {
  it('places its edges at nothing and at one, and its marks in between', () => {
    expect(spectrumFraction(LOWEST_HZ)).toBe(0)
    expect(spectrumFraction(HIGHEST_HZ)).toBe(1)

    for (const mark of SPECTRUM_MARKS) {
      expect(spectrumFraction(mark)).toBeGreaterThan(0)
      expect(spectrumFraction(mark)).toBeLessThan(1)
    }
  })

  it('spaces a decade evenly, wherever on the scale it falls', () => {
    const low = spectrumFraction(1_000) - spectrumFraction(100)
    const high = spectrumFraction(10_000) - spectrumFraction(1_000)

    expect(high).toBeCloseTo(low, 6)
  })

  it('holds anything outside the band at the edge it went past', () => {
    expect(spectrumFraction(20)).toBe(0)
    expect(spectrumFraction(22_000)).toBe(1)
  })
})
