import { create } from 'zustand'
import type { FavoriteRecipe } from '@shared/domain/favorite'
import { getBridge } from '@/services/bridge'

type FavoritesState = {
  recipes: readonly FavoriteRecipe[]
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
 *
 * Every write answers with the whole list, so nothing here guesses where a new recipe landed.
 */
export const useFavorites = create<FavoritesState>()(set => {
  const run = async (
    call: (bridge: NonNullable<ReturnType<typeof getBridge>>) => Promise<FavoriteRecipe[]>,
  ): Promise<void> => {
    const bridge = getBridge()
    if (!bridge) return

    try {
      set({ recipes: await call(bridge) })
    } catch {
      // An unreadable folder is an empty shelf, never a home that loses a band over it.
    }
  }

  return {
    recipes: [],

    load: () => run(bridge => bridge.favorites.list()),
    pin: assetId => run(bridge => bridge.favorites.pin(assetId)),
    unpin: id => run(bridge => bridge.favorites.unpin(id)),
  }
})
