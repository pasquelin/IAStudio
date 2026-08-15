import { clamp } from '@shared/numeric'

/**
 * The lowest frequency the band starts at. Below it there is nothing to judge on a montage —
 * room rumble and the DC the analyser's first bin carries — and reading from zero would spend a
 * third of the width on it.
 */
export const LOWEST_HZ = 40

/** Where the band stops. Above it lies air, and a scale that runs to 24 kHz wastes its top third. */
export const HIGHEST_HZ = 16_000

/** One bar of the band: what it covers, and how loud that part of the sound is. */
export type SpectrumBand = {
  /** The lower edge, in hertz — the bar's own place on the scale. */
  from: number
  /**
   * Where this register stands on the METER's scale, from nothing at its floor to one at full
   * scale — a fraction, never an amplitude. That is what the analyser hands over, its byte range
   * being spread across the decibels `sound-port.ts` sets on it.
   */
  level: number
}

/**
 * The analyser's bins, folded into bars spread by OCTAVE rather than by hertz.
 *
 * An FFT spreads its bins evenly in hertz, which is not how anyone hears: half of them describe
 * the top octave alone. Read that way, a whole mix crowds into the first two bars and everything
 * to their right is the air above the cymbals. Spread by octave, each bar covers the same musical
 * distance as its neighbour, which is the shape every analyser on every desk is drawn in.
 *
 * A bar takes the LOUDEST bin it spans, never their average: the low bars span one or two bins
 * and the high ones span hundreds, and averaging would fade out exactly the bars that cover the
 * most ground.
 */
export function spectrumBands(bins: Uint8Array, sampleRate: number, count: number): SpectrumBand[] {
  if (bins.length === 0 || count <= 0 || sampleRate <= 0) return []

  // Nyquist over the bin count: the top bin sits at half the rate, whatever the FFT size was.
  const perBin = sampleRate / 2 / bins.length
  const ratio = HIGHEST_HZ / LOWEST_HZ

  return Array.from({ length: count }, (_unused, index) => {
    const from = LOWEST_HZ * ratio ** (index / count)
    const to = LOWEST_HZ * ratio ** ((index + 1) / count)

    // At least one bin wide: the lowest bars are narrower than a bin, and a bar spanning none
    // would read as silence in the register a montage is usually loudest in.
    const first = clamp(Math.floor(from / perBin), 0, bins.length - 1)
    const last = clamp(Math.ceil(to / perBin), first + 1, bins.length)

    let loudest = 0
    for (let at = first; at < last; at++) loudest = Math.max(loudest, bins[at] ?? 0)

    return { from, level: loudest / 255 }
  })
}

/** The decades a spectrum is graduated at — the marks every analyser writes, and no others. */
export const SPECTRUM_MARKS = [100, 1_000, 10_000]

/** Where a frequency stands across the band, from nothing at its left edge to one at its right. */
export function spectrumFraction(hz: number): number {
  return clamp(Math.log(hz / LOWEST_HZ) / Math.log(HIGHEST_HZ / LOWEST_HZ), 0, 1)
}
