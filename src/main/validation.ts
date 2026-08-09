import { z } from 'zod'

/**
 * One name inside one folder. Anything that would create a nested folder, or escape into one, is
 * not one — and every value validated with this comes from a window and ends up in a `join`.
 *
 * Shared at the third copy, and the sharing is the point: the guard is the `refine`, and a
 * fourth store reaching for a bounded id and stopping at `.max(120)` would leave a path
 * traversal behind with nothing to say it was missing.
 */
export const pathSegment = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(value => !/[/\\]/.test(value) && value !== '.' && value !== '..')
  // A control character is no escape, but every filesystem call throws on one — after the folder
  // was made and the values before it were written, which leaves something nobody can tell from
  // finished work. `\p{Cc}` rather than a range of literal control characters, which the linter
  // refuses.
  .refine(value => !/\p{Cc}/u.test(value))
