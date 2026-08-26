import { z } from 'zod'
import { ASSET_TYPES } from '@shared/domain/asset'
import type { FavoriteRecipe } from '@shared/domain/favorite'
import { pathSegment } from '@main/validation'

/**
 * Both channels take one identifier and nothing else — an asset's on the way in, a recipe's on
 * the way out. Both end up in a `join` against the favourites folder, so both go through the
 * shared segment guard.
 */
const favoriteId = pathSegment

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
  /**
   * Brought up to date before the enum sees it — a whole entry is DROPPED on a value it does not
   * name, and this file has no version to migrate on. `texture` was a kind of its own until
   * 2026-08-26: every recipe pinned from the Materials space carries it, and every one of them
   * would have left the shelf without a word, then left the FILE at the next pin.
   */
  type: z.preprocess(stored => (stored === 'texture' ? 'image' : stored), z.enum(ASSET_TYPES)),
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
