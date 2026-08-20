import { z } from 'zod'

// `safeFileName` cuts at 80 CODE POINTS; counting UTF-16 units here refused what it had produced.
const MAX_CODE_POINTS = 120

// Units first, and short-circuited: zod runs every `refine` after a failed check, so a `.max` in
// the chain would NOT keep an unbounded string from being spread. A code point is two units at
// most, so the cheap half refuses nothing the exact half keeps.
export const withinCodePoints =
  (max: number) =>
  (value: string): boolean =>
    value.length <= max * 2 && [...value].length <= max

/** One name inside one folder: the guard is the `refine`, never the bound. */
export const pathSegment = z
  .string()
  .trim()
  .min(1)
  .refine(withinCodePoints(MAX_CODE_POINTS))
  .refine(value => !/[/\\]/.test(value))
  // `.` and `..` climb, and Windows drops a TRAILING dot silently — `Niveau.` and `Niveau` become
  // one file there and two everywhere else, so the second write overwrites the first.
  // `safeFileName` refuses to produce either end.
  .refine(value => !value.startsWith('.') && !value.endsWith('.'))
  // A control character is no escape, but every filesystem call throws on one, after the folder
  // around it was written — and `\p{Cc}` rather than literal control characters, which the
  // linter refuses.
  .refine(value => !/\p{Cc}/u.test(value))
