import { readString } from '../guards'

/**
 * A colour as this studio writes them, and the only shape it can be trusted about: `#rrggbb`.
 *
 * The reason is the control, not three.js. `Color.set` honours `red`, `rgb(255,0,0)` and `#fff`
 * without a word — measured — while `<input type="color">` coerces every one of them to
 * `#000000`. A document holding one of those opens on three disagreeing answers: the swatch of
 * `ColorField` shows black, the text beside it shows the raw string, and the render shows the
 * colour three understood. Six digits is what makes those three agree.
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
