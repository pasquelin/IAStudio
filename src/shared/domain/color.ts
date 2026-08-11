import { readString } from '../guards'

/**
 * A colour as this studio writes them: `#rrggbb`, what `<input type="color">` reports and the
 * only notation any of its own code has ever stored.
 *
 * The shape is a consistency rule, not a rescue — and the difference matters, because two
 * plausible rescues were measured and neither holds. three.js renders `red`, `rgb(255,0,0)`,
 * `hsl(0,100%,50%)` and `#fff` without a word; Chromium 150 normalises all four to `#rrggbb` in
 * the swatch. What the shape buys is that the file, the control and the render carry the SAME
 * string, and that documents obey the rule `main/settings/validation.ts` already imposed on the
 * accent — where six digits are load-bearing, `tokenAsHex` reading `#fff` as `0xfff`.
 *
 * What it also catches is the class three.js refuses outright — `banana`, `ffffff`, `#ff00` — for
 * which `Color.set` logs and leaves the material at its previous colour, silently.
 */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * A colour read back from a document, held to that shape — composed the way an angle is
 * (`clampElevation(readNumber(…))`): the shape belongs to the domain, and `readString` only
 * answers whether the field is text at all.
 */
export function readColor(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = readString(source, key, fallback)
  return HEX_COLOR.test(value) ? value : fallback
}

const CHANNEL_WEIGHTS = [0.2126, 0.7152, 0.0722]

function channels(colour: string): number[] {
  return [1, 3, 5].map(at => parseInt(colour.slice(at, at + 2), 16))
}

/** Relative luminance, WCAG 2.x. Expects the `#rrggbb` shape above; anything else reads as black. */
export function relativeLuminance(colour: string): number {
  return channels(colour)
    .map(value => value / 255)
    .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + (CHANNEL_WEIGHTS[index] ?? 0) * value, 0)
}

/** The WCAG contrast ratio of two colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(one: string, other: string): number {
  const first = relativeLuminance(one)
  const second = relativeLuminance(other)

  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** What WCAG 1.4.3 asks of normal text — every size this studio writes falls under it. */
export const AA_NORMAL_TEXT = 4.5

function toHex(values: number[]): string {
  return `#${values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The same hue, moved until it can carry a word on `backdrop` — toward white on a dark one,
 * toward black on a light one.
 *
 * A fill and an ink cannot be the same colour: the studio's own blue reads 3.23:1 as a word on
 * the chassis, and lightening it to fix that would take white ON it from 4.28 to 3.01. So the
 * sheet declares both, and the accent a user PICKS has to be given the same pair — otherwise
 * choosing red repaints the buttons and leaves every accented word the blue it shipped with.
 *
 * Returns `accent` itself when it already clears the threshold, and the nearest endpoint when
 * no step of the ramp does — white on a light backdrop never will, and a colour is better than
 * nothing on a screen.
 */
export function inkFor(accent: string, backdrop: string, threshold = AA_NORMAL_TEXT): string {
  if (!HEX_COLOR.test(accent) || !HEX_COLOR.test(backdrop)) return accent

  const towardsWhite = relativeLuminance(backdrop) < 0.5
  const from = channels(accent)
  const target = towardsWhite ? 255 : 0

  for (let step = 0; step <= 100; step++) {
    const moved = toHex(from.map(value => value + (target - value) * (step / 100)))
    if (contrastRatio(moved, backdrop) >= threshold) return moved
  }

  return towardsWhite ? '#ffffff' : '#000000'
}
