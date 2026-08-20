import { readString } from '../guards'
import { clamp } from '../numeric'

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

/**
 * `#rrggbb` as the `0xrrggbb` the drawing engines take, or `null` for anything else.
 *
 * `null` rather than a fallback colour: a caller handing this a value it cannot read is a caller
 * that must refuse, not one that should silently paint black.
 */
export function packedColour(colour: string): number | null {
  return HEX_COLOR.test(colour) ? Number.parseInt(colour.slice(1), 16) : null
}

const CHANNEL_WEIGHTS = [0.2126, 0.7152, 0.0722]

/** A tuple rather than an array: `#rrggbb` has exactly three, and a caller that reads them by
 *  index otherwise carries a fallback branch nothing can ever reach. */
function channels(colour: string): [number, number, number] {
  return [
    parseInt(colour.slice(1, 3), 16),
    parseInt(colour.slice(3, 5), 16),
    parseInt(colour.slice(5, 7), 16),
  ]
}

const toLinear = (value: number): number =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4

const toSrgb = (value: number): number =>
  value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055

/**
 * `#rrggbb` as the LINEAR triple every interchange format writes a colour in — glTF's
 * `KHR_lights_punctual` among them, whose specification says so in as many words.
 *
 * Not the same transfer as `relativeLuminance`, which uses the WCAG threshold of 0.03928: this
 * one is the sRGB standard's own 0.04045. The two differ in the sixth decimal and never in a
 * ratio, but a file written with the wrong one is a colour another renderer disagrees with.
 */
export function linearRgbOf(colour: string): [number, number, number] {
  const [red, green, blue] = channels(HEX_COLOR.test(colour) ? colour : '#000000')
  return [toLinear(red / 255), toLinear(green / 255), toLinear(blue / 255)]
}

/** The way back, for a file written elsewhere. Out-of-range channels are clamped, never wrapped. */
export function colourFromLinearRgb(linear: readonly number[]): string {
  return toHex([0, 1, 2].map(index => toSrgb(clamp(linear[index] ?? 0, 0, 1)) * 255))
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

/**
 * An ink laid over a fill at `alpha`, as the compositor would — the colour a reader actually sees.
 *
 * A contrast ratio can only be taken between two OPAQUE colours: `text-muted/70` is not a colour,
 * it is an instruction. Fourteen iterations of the design loop measured only opaque tokens, and
 * that is exactly where the last two contrast defects hid.
 */
export function blend(ink: string, fill: string, alpha: number): string {
  if (!HEX_COLOR.test(ink) || !HEX_COLOR.test(fill)) return ink

  const [red, green, blue] = channels(ink)
  const [underRed, underGreen, underBlue] = channels(fill)
  const mix = (over: number, under: number): number => over * alpha + under * (1 - alpha)

  return toHex([mix(red, underRed), mix(green, underGreen), mix(blue, underBlue)])
}

/** What WCAG 1.4.3 asks of normal text — every size this studio writes falls under it. */
export const AA_NORMAL_TEXT = 4.5

/**
 * What WCAG 1.4.11 asks of anything that is not text but has to be SEEN: a focus ring, a glyph
 * standing alone, the edge of a control. Lower than the text bar because a shape is recognised
 * from less than a letterform is read.
 */
export const AA_NON_TEXT = 3

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

/**
 * What to write ON `fill` — the counterpart of `inkFor`, which answers what to write IN that
 * colour on a studio surface.
 *
 * Two candidates rather than a ramp: an ink laid on a fill has nowhere to travel to without
 * becoming the fill itself. White is kept whenever it clears the bar, so the studio's own blue
 * goes on carrying white words rather than flipping to black over a tenth of a point; below the
 * bar the fill is light enough that black is the answer, and by a wide margin — a picked yellow
 * takes white to 1.71:1 and black to 12.30.
 *
 * **At the AA threshold the second branch is unreachable, and that is arithmetic rather than
 * luck**: white fails ABOVE a luminance of 0.1833 and black fails BELOW 0.175, so the two ranges
 * overlap and one of them always answers. It is written for the callers that ask for more — at
 * 7:1 the gap between 0.10 and 0.30 has no good ink at all, and the better of the two is still
 * the better of the two.
 */
export function contentFor(fill: string, threshold = AA_NORMAL_TEXT): string {
  if (!HEX_COLOR.test(fill)) return '#ffffff'

  const onWhite = contrastRatio('#ffffff', fill)
  if (onWhite >= threshold) return '#ffffff'

  return contrastRatio('#000000', fill) > onWhite ? '#000000' : '#ffffff'
}

/** How far a hover moves its fill — the step the sheet's own `create` pair was drawn at. */
const HOVER_STEP = 0.2

/**
 * Below this, two fills are the same colour to a reader and the hover says nothing.
 *
 * Exported because it is a bar like `AA_NORMAL_TEXT` and not a tuning knob: raised to 1.3 it
 * takes 4595 hues of a 61 200 sweep from having a hover to having none — `#009900` among them —
 * and every assertion of this module went on passing until one counted them.
 */
export const HOVER_IS_SEEN = 1.1

/**
 * The fill a button takes under the pointer — darker, or lighter when darker would not be read.
 *
 * A hover written as an ALPHA of the fill cannot answer this: `bg-accent/85` lets the surface
 * through, so it darkens the blue on a dark panel and LIGHTENS it on a light one. The studio's
 * primary button did exactly that, and its white label fell to 3.52:1 on the light theme — below
 * the 4.5 it clears at rest, which is the one place a hover must never take a word.
 *
 * Darkening is tried first because that is the conventional direction for a FILL a word is
 * written on, and it is kept unless it would take that word under the bar — a yellow carries
 * black, and black on a darker yellow eventually stops being read. It is not a rule about hovers
 * in general: the studio's neutral button goes from `surface` to `elevated`, which lightens on
 * the dark theme, because those are two named tokens rather than one derived from the other.
 *
 * Both directions failing leaves the fill untouched, and a hover nobody sees is better than a
 * label nobody reads. How many hues that is, is counted by `color.test.ts` rather than written
 * here, where the number would outlive the step it comes from.
 *
 * The step is not invented: at 0.2 this reproduces `--color-create-hover` to the byte, in BOTH
 * themes, from the `create` the sheet ships — the one hover pair a human picked here by eye.
 * `tokens.test.ts` holds that against the stylesheet, so the claim cannot rot into prose.
 */
export function hoverFor(fill: string, threshold = AA_NORMAL_TEXT): string {
  if (!HEX_COLOR.test(fill)) return fill

  const ink = contentFor(fill, threshold)

  for (const target of ['#000000', '#ffffff']) {
    const moved = blend(target, fill, HOVER_STEP)
    if (contrastRatio(ink, moved) >= threshold && contrastRatio(fill, moved) >= HOVER_IS_SEEN) {
      return moved
    }
  }

  return fill
}
