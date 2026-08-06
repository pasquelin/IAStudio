import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Asset } from '@shared/domain/asset'
import { getBridge } from '@/services/bridge'

export type AssetsView = 'grid' | 'list'

type AssetsState = {
  view: AssetsView
  setView: (view: AssetsView) => void

  items: Asset[]
  /** Loadable URLs, resolved lazily: only what reaches the screen needs one. */
  urls: Record<string, string>

  refresh: () => Promise<void>
  resolveUrl: (assetId: string) => Promise<void>
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
    (set, get) => ({
      view: 'grid',
      setView: view => set({ view }),

      items: [],
      urls: {},

      refresh: async () => {
        const bridge = getBridge()
        if (!bridge) return

        try {
          set({ items: await bridge.assets.search({}) })
        } catch {
          // No project open: an empty browser is the honest answer, not an error.
          set({ items: [], urls: {} })
        }
      },

      resolveUrl: async assetId => {
        const bridge = getBridge()
        if (!bridge || get().urls[assetId]) return

        const url = await bridge.assets.url(assetId)
        if (url) set(state => ({ urls: { ...state.urls, [assetId]: url } }))
      },
    }),
    { name: 'scenario-studio:assets', partialize: state => ({ view: state.view }) },
  ),
)
