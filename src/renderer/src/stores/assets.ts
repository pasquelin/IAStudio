import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AssetsView = 'grid' | 'list'

type AssetsState = {
  view: AssetsView
  setView: (view: AssetsView) => void
}

/**
 * The view lives in a store rather than in the component: its buttons are rendered by the
 * panel header, the grid by its content, and both must read the same value.
 */
export const useAssets = create<AssetsState>()(
  persist(
    set => ({
      view: 'grid',
      setView: view => set({ view }),
    }),
    { name: 'scenario-studio:assets' },
  ),
)
