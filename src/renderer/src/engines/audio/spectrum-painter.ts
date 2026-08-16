import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import type { Size } from '@/engines/core/geometry'
import { memoPalette, rootColour, rootFont } from '@/engines/core/palette'
import { formatDecimal } from '@/helpers/format'
import { levelAtFraction } from './level'
import { spectrumFraction, SPECTRUM_MARKS, type SpectrumBand } from './spectrum'

/** What a spectrum needs of a palette. The three bands are the wave's own, and mean the same. */
export type SpectrumInk = {
  background: string
  safe: string
  hot: string
  clip: string
  line: string
  text: string
  font: string
}

/**
 * The words on the scale, already written out — one per decade, in the order `SPECTRUM_MARKS`
 * gives them.
 *
 * Composed by the host rather than here because they change on a different event from the inks:
 * the palette follows the theme, these follow the language, and one memo cannot answer to both.
 * Written out rather than formatted per paint — three `Intl` calls a frame is a hundred and
 * eighty a second for three words that only move when the tongue does.
 */
export type SpectrumMarks = readonly string[]

/**
 * The decades as a reader reads them: hertz below a thousand, kilohertz above, as every analyser
 * is graduated — `10 000 Hz` is a number one counts the digits of.
 *
 * The units arrive translated, the way `formatBytes` takes its own: a painter reads tokens, never
 * a bundle.
 */
export function spectrumLabels(
  units: { hertz: string; kilohertz: string },
  language: string,
): SpectrumMarks {
  return SPECTRUM_MARKS.map(mark => {
    const kilo = mark >= 1_000
    const value = kilo ? mark / 1_000 : mark
    const unit = kilo ? units.kilohertz : units.hertz

    return `${formatDecimal(value, language, { digits: 0 })}${NO_BREAK_SPACE}${unit}`
  })
}

/** Monospace and the smallest step, as every graduation the studio paints. */
const MARK_FAMILY = 'ui-monospace, monospace'
const MARK_SIZE = '9px'

export const readSpectrumInk = memoPalette((): SpectrumInk => ({
  // The toolbar's own fill, not the chassis the wave is drawn on: the spectrum is a piece of
  // furniture standing in the monitor rather than another view of the montage, and it reads as
  // one by wearing what the bar right below it wears.
  background: rootColour('--color-surface'),
  safe: rootColour('--color-level-safe'),
  hot: rootColour('--color-warning'),
  clip: rootColour('--color-danger'),
  line: rootColour('--color-border'),
  text: rootColour('--color-muted'),
  font: rootFont('--text-micro', MARK_SIZE, MARK_FAMILY),
}))

/** How much room the marks are given at the foot of the band, and the gap between two bars. */
const MARK_BAND = 12
const BAR_GAP = 1

/**
 * The sound by register: bass on the left, air on the right, loudness as height.
 *
 * Coloured by the same three bands as the wave above it, and that is the point of reusing them —
 * an amber bar here means what an amber crest means there, a register within six decibels of the
 * ceiling. A palette of its own would have been a second colour language on one surface.
 */
export function paintSpectrum(
  context: CanvasRenderingContext2D,
  size: Size,
  bands: readonly SpectrumBand[],
  ink: SpectrumInk,
  marks: SpectrumMarks,
): void {
  context.fillStyle = ink.background
  context.fillRect(0, 0, size.width, size.height)

  const height = Math.max(0, size.height - MARK_BAND)
  paintMarks(context, size, height, ink, marks)

  if (bands.length === 0) return

  const width = size.width / bands.length
  for (const [index, band] of bands.entries()) {
    if (band.level <= 0) continue

    const reach = band.level * height
    context.fillStyle = ink[levelAtFraction(band.level)]
    context.fillRect(index * width, height - reach, Math.max(1, width - BAR_GAP), reach)
  }
}

/** The decades, written under the bars where they cannot be mistaken for one. */
function paintMarks(
  context: CanvasRenderingContext2D,
  size: Size,
  height: number,
  ink: SpectrumInk,
  marks: SpectrumMarks,
): void {
  context.font = ink.font
  context.textBaseline = 'bottom'

  for (const [index, mark] of SPECTRUM_MARKS.entries()) {
    const x = Math.round(size.width * spectrumFraction(mark))

    context.fillStyle = ink.line
    context.fillRect(x, 0, 1, height)

    const label = marks[index]
    if (label === undefined) continue

    context.fillStyle = ink.text
    context.fillText(label, x + BAR_GAP * 2, size.height)
  }
}
