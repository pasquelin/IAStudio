import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isAssetType, type AssetGeneration, type AssetType } from '@shared/domain/asset'
import { FAVORITES_MAX, sameRecipe, type FavoriteRecipe } from '@shared/domain/favorite'
import { isRecord } from '@shared/guards'

/** What a pin carries beyond the recipe itself: the still to keep, when there was one to copy. */
export type FavoriteDraft = {
  id: string
  label: string
  type: AssetType
  generation: AssetGeneration
  pinnedAt: string
  thumbnail: Uint8Array | null
}

export type FavoritesStore = {
  list: () => Promise<FavoriteRecipe[]>
  /** Answers the whole list, as the account channels do: one write, one truth back. */
  pin: (draft: FavoriteDraft) => Promise<FavoriteRecipe[]>
  unpin: (id: string) => Promise<FavoriteRecipe[]>
  /** The file behind `scenario://favorite/<id>`, or null when this build kept none. */
  thumbnailPath: (id: string) => Promise<string | null>
}

const INDEX = 'favorites.json'
const THUMBNAIL_EXTENSION = '.png'

/**
 * The pinned recipes, in a folder of their own beside the settings.
 *
 * Deliberately not in a project and deliberately not in the settings: a favourite outlives the
 * project it was taken in — that is what it is for — and the settings are a replicated document
 * that every window rewrites, which a still on disk has no business being part of.
 *
 * The folder is the truth. The index names what the shelf shows and the stills sit next to it,
 * one file per recipe, so removing one is removing two files and nothing else.
 */
export function createFavorites(folder: string): FavoritesStore {
  const indexPath = join(folder, INDEX)
  const thumbnailPath = (id: string): string => join(folder, `${id}${THUMBNAIL_EXTENSION}`)

  const read = async (): Promise<FavoriteRecipe[]> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(indexPath, 'utf8'))
      return Array.isArray(parsed) ? parsed.flatMap(entry => recipeOf(entry) ?? []) : []
    } catch {
      // No file yet, or one edited into something unreadable: an empty shelf, never a failure —
      // the home would lose a band over a file the user was not supposed to know about.
      return []
    }
  }

  const write = async (recipes: readonly FavoriteRecipe[]): Promise<FavoriteRecipe[]> => {
    await mkdir(folder, { recursive: true })
    await writeFile(indexPath, JSON.stringify(recipes, null, 2), 'utf8')
    return [...recipes]
  }

  return {
    list: read,

    pin: async draft => {
      const recipes = await read()

      // Pinning the same recipe again is the same intention twice. It moves back to the front
      // rather than being refused: the gesture has to do something visible.
      const existing = recipes.find(recipe => sameRecipe(recipe.generation, draft.generation))
      if (existing) {
        return write([existing, ...recipes.filter(recipe => recipe.id !== existing.id)])
      }

      // Refused rather than evicting the oldest: a favourite that vanished to make room would
      // be a shelf that loses things on its own.
      if (recipes.length >= FAVORITES_MAX) return recipes

      if (draft.thumbnail) {
        await mkdir(folder, { recursive: true })
        await writeFile(thumbnailPath(draft.id), draft.thumbnail)
      }

      const recipe: FavoriteRecipe = {
        id: draft.id,
        label: draft.label,
        type: draft.type,
        generation: draft.generation,
        pinnedAt: draft.pinnedAt,
        hasThumbnail: draft.thumbnail !== null,
      }

      return write([recipe, ...recipes])
    },

    unpin: async id => {
      const recipes = await read()
      const kept = recipes.filter(recipe => recipe.id !== id)
      if (kept.length === recipes.length) return recipes

      // The still goes with the line that named it; a folder of orphans nothing reads would
      // grow for as long as the studio is used.
      await rm(thumbnailPath(id), { force: true })
      return write(kept)
    },

    thumbnailPath: async id => {
      const recipes = await read()
      const recipe = recipes.find(candidate => candidate.id === id)
      return recipe?.hasThumbnail === true ? thumbnailPath(recipe.id) : null
    },
  }
}

/**
 * One entry of the index, or null when it is not one. The file sits in the user's own folder:
 * a line edited into something else drops out rather than reaching the window as a half-recipe
 * whose `generation.modelId` is undefined.
 */
function recipeOf(value: unknown): FavoriteRecipe | null {
  if (!isRecord(value)) return null

  const { id, label, type, pinnedAt, hasThumbnail, generation } = value
  if (typeof id !== 'string' || id === '' || typeof label !== 'string') return null
  if (!isAssetType(type) || typeof pinnedAt !== 'string') return null

  const parsed = generationOf(generation)
  if (!parsed) return null

  return { id, label, type, generation: parsed, pinnedAt, hasThumbnail: hasThumbnail === true }
}

function generationOf(value: unknown): AssetGeneration | null {
  if (!isRecord(value)) return null

  const { modelId, modelLabel, prompt, params, seed } = value
  if (typeof modelId !== 'string' || modelId === '') return null

  return {
    modelId,
    modelLabel: typeof modelLabel === 'string' ? modelLabel : '',
    prompt: typeof prompt === 'string' ? prompt : '',
    params: isRecord(params) ? params : {},
    ...(typeof seed === 'number' ? { seed } : {}),
  }
}
