import { formatDecimal } from '@/helpers/format'

/**
 * What a ruler is graduated in. The step is chosen from the zoom, never fixed: at 5% a tick
 * every 10 px is a grey band, and at 1600% one every 100 px leaves the ruler blank.
 */
type RulerStep = { major: number; minor: number }

/** Below this the labels of two neighbouring majors touch. */
const MIN_MAJOR_PX = 72

/** Powers of ten times these, which is how every ruler in every editor is graduated. */
const MANTISSAS: readonly number[] = [1, 2, 5]

/** How many minors a major is cut into, per mantissa: halves read wrong under a 2. */
const SUBDIVISIONS: Record<number, number> = { 1: 5, 2: 4, 5: 5 }

/** The smallest 1-2-5 step whose majors stay at least `MIN_MAJOR_PX` apart on screen. */
export function rulerStep(scale: number): RulerStep {
  const wanted = MIN_MAJOR_PX / (scale > 0 ? scale : 1)
  const decade = Math.pow(10, Math.floor(Math.log10(Math.max(wanted, Number.MIN_VALUE))))

  for (const mantissa of MANTISSAS) {
    const major = mantissa * decade
    if (major >= wanted) return { major, minor: major / (SUBDIVISIONS[mantissa] ?? 5) }
  }
  const major = 10 * decade
  return { major, minor: major / 5 }
}

/** Guards a pathological zoom from emitting a tick per screen pixel for a whole frame. */
const MAX_TICKS = 4096

/**
 * Every multiple of `step` inside `[from, to]`, in document units. Ordered, and inclusive of a
 * bound that lands exactly on a multiple.
 */
export function ticks(from: number, to: number, step: number): number[] {
  if (!(step > 0) || !Number.isFinite(from) || !Number.isFinite(to) || to < from) return []

  const first = Math.ceil(from / step)
  const last = Math.floor(to / step)
  if (last - first + 1 > MAX_TICKS) return []

  const values: number[] = []
  for (let index = first; index <= last; index += 1) values.push(index * step)
  return values
}

/**
 * A tick's label. Trailing zeros of a fractional step are kept — a ruler stepping by 0.5 that
 * printed `1` twice would be lying about where the second tick is.
 *
 * Ungrouped, and it is the one thing this asks of the formatter that a file size does not: the
 * labels sit a few pixels apart, where a thousands separator reads as a second number.
 */
export function tickLabel(value: number, step: number, language: string): string {
  const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)))
  // `ticks` produces `-0` for the tick at the origin when the range starts negative, and a
  // ruler graduated `-0` is a defect.
  const shown = value === 0 ? 0 : value
  return formatDecimal(shown, language, { digits: decimals, least: decimals, grouped: false })
}
