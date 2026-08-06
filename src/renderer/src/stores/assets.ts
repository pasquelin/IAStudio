import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'

export type AssetsView = 'grid' | 'list'

type AssetsState = {
  view: AssetsView
  setView: (view: AssetsView) => void

  items: Asset[]
  refresh: () => Promise<void>
}

/**
 * The view lives in a store rather than in the component: its buttons are rendered by the
 * panel header, the grid by its content, and both must read the same value.
 *
 * Only the view is persisted. The catalogue belongs to the project, and a list restored from
 * the last session would show what a different project contained.
 */
export const useAssets = create<AssetsState>()(
  persist(
    set => ({
      view: 'grid',
      setView: view => set({ view }),

      items: [],

      refresh: async () => {
        const bridge = getBridge()
        if (!bridge) return

        try {
          set({ items: await bridge.assets.search({}) })
        } catch {
          // No project open: the catalogue throws, and an empty list is the honest answer.
          set({ items: [] })
        }
      },
    }),
    { name: 'scenario-studio:assets', partialize: state => ({ view: state.view }) },
  ),
)
