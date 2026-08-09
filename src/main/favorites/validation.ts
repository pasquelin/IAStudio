import { z } from 'zod'

/**
 * Both channels take one identifier and nothing else — an asset's on the way in, a recipe's on
 * the way out. Bounded because both end up in a `join` against the favourites folder, and a
 * window is trusted for nothing.
 */
const favoriteId = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(value => !/[/\\]/.test(value) && value !== '.' && value !== '..')

export function parseFavoriteId(value: unknown): string {
  return favoriteId.parse(value)
}
