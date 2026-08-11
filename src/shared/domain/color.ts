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
