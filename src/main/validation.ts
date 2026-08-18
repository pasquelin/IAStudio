import { z } from 'zod'

/**
 * As long as one name may be, in CODE POINTS. `safeFileName` cuts at 80 of them, and counting
 * UTF-16 units here refused what it had just produced — 61 astral code points make 122 units.
 */
const MAX_CODE_POINTS = 120

/**
 * One name inside one folder. Anything that would create a nested folder, or escape into one, is
 * not one — and every value validated with this comes from a window and ends up in a `join`.
 *
 * The guard is the `refine`, never the bound: a store reaching for a bounded id and stopping at
 * a length would leave a path traversal behind with nothing to say it was missing.
 */
export const pathSegment = z
  .string()
  .trim()
  .min(1)
  // A code point is two UTF-16 units at most, so this refuses nothing the count below keeps —
  // it is here so an unbounded string is never spread.
  .max(MAX_CODE_POINTS * 2)
  .refine(value => [...value].length <= MAX_CODE_POINTS)
  .refine(value => !/[/\\]/.test(value) && value !== '.' && value !== '..')
  // A control character is no escape, but every filesystem call throws on one — after the folder
  // was made and the values before it were written, which leaves something nobody can tell from
  // finished work. `\p{Cc}` rather than a range of literal control characters, which the linter
  // refuses.
  .refine(value => !/\p{Cc}/u.test(value))
