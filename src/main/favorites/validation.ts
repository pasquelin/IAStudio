import { z } from 'zod'
import { ASSET_TYPES } from '@shared/domain/asset'
import type { FavoriteRecipe } from '@shared/domain/favorite'

/**
 * Both channels take one identifier and nothing else — an asset's on the way in, a recipe's on
 * the way out. Bounded and refusing a separator because both end up in a `join` against the
 * favourites folder, and a window is trusted for nothing.
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

/**
 * The index as it comes off disk. It sits in the user's own folder, so an entry that does not
 * parse is dropped rather than failing the read — the same move `parseStoredJobs` makes, for the
 * same reason: a file the studio cannot make sense of must not be a shelf that disappears.
 *
 * The recipe itself is lenient where the API is: a model with no label and a generation with no
 * prompt are both things the catalogue records.
 */
const storedRecipe = z.object({
  id: favoriteId,
  label: z.string(),
  type: z.enum(ASSET_TYPES),
  generation: z.object({
    modelId: z.string().trim().min(1),
    modelLabel: z.string().catch(''),
    prompt: z.string().catch(''),
    params: z.record(z.string(), z.unknown()).catch({}),
    seed: z.number().optional(),
  }),
  pinnedAt: z.string().trim().min(1),
  hasThumbnail: z.boolean().catch(false),
})

const storedIndex = z.array(storedRecipe.nullable().catch(null))

export function parseFavoriteIndex(content: string): FavoriteRecipe[] {
  try {
    const parsed: unknown = JSON.parse(content)
    return storedIndex.parse(parsed).filter(recipe => recipe !== null)
  } catch {
    // Not JSON at all, or not a list: beyond recovery whatever we do, and the next pin writes
    // over it. Refusing would wedge the folder for good.
    return []
  }
}
