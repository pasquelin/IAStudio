import { create } from 'zustand'
import type { FavoriteRecipe } from '@shared/domain/favorite'
import { getBridge } from '@/services/bridge'

type FavoritesState = {
  recipes: readonly FavoriteRecipe[]
  /** Whether the folder has been read once. Nothing outside this window writes it. */
  loaded: boolean

  /** Reads the folder, once per window: every write answers with the whole list. */
  load: () => Promise<void>
  pin: (assetId: string) => Promise<void>
  unpin: (id: string) => Promise<void>
}

/**
 * The pinned recipes, as this window sees them.
 *
 * Held in a store rather than read per surface: the inspector pins and the home's shelf shows,
 * neither owns the list, and a recipe pinned from the inspector has to appear on the home
 * without a trip through the disk.
 */
export const useFavorites = create<FavoritesState>()((set, get) => {
  const run = async (answer: Promise<FavoriteRecipe[]> | undefined): Promise<void> => {
    try {
      const recipes = await answer
      if (recipes) set({ recipes, loaded: true })
    } catch {
      // An unreadable folder is an empty shelf, never a home that loses a band over it.
      set({ loaded: true })
    }
  }

  return {
    recipes: [],
    loaded: false,

    load: async () => {
      if (get().loaded) return
      await run(getBridge()?.favorites.list())
    },

    pin: assetId => run(getBridge()?.favorites.pin(assetId)),
    unpin: id => run(getBridge()?.favorites.unpin(id)),
  }
})
