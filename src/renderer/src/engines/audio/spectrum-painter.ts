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
 * The words on the scale, handed over already translated — the two units and the tongue the
 * numbers read in. Apart from the inks because they change on a different event: the palette
 * follows the theme, these follow the language, and one memo cannot answer to both.
 */
export type SpectrumMarks = {
  hertz: string
  kilohertz: string
  language: string
}

/** Monospace and the smallest step, as every graduation the studio paints. */
const MARK_FAMILY = 'ui-monospace, monospace'
const MARK_SIZE = '9px'

export const readSpectrumInk = memoPalette((): SpectrumInk => ({
  background: rootColour('--color-chassis'),
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

  for (const mark of SPECTRUM_MARKS) {
    const x = Math.round(size.width * spectrumFraction(mark))

    context.fillStyle = ink.line
    context.fillRect(x, 0, 1, height)

    context.fillStyle = ink.text
    context.fillText(labelFor(mark, marks), x + BAR_GAP * 2, size.height)
  }
}

/**
 * Kilohertz past a thousand, as a spectrum is always graduated: `10 000 Hz` is a number one has
 * to count the digits of, where `10 kHz` is the mark every analyser writes.
 */
function labelFor(mark: number, marks: SpectrumMarks): string {
  const kilo = mark >= 1_000
  const value = kilo ? mark / 1_000 : mark
  const unit = kilo ? marks.kilohertz : marks.hertz

  return `${formatDecimal(value, marks.language, { digits: 0 })}${NO_BREAK_SPACE}${unit}`
}
