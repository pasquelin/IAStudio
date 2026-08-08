import { create } from 'zustand'
import type { SyncOutcome, SyncPlan, SyncPolicy } from '@shared/domain/sync'
import { getBridge } from '@/services/bridge'
import { useAssets } from './assets'

export type CloudState = {
  /** One transfer at a time, so a second click cannot start a second push over the first. */
  busy: boolean
  /** What the last push or pull did, kept until the next one starts. */
  outcomes: readonly SyncOutcome[]
  push: (assetIds: readonly string[]) => Promise<void>
  pull: (remoteAssetIds: readonly string[]) => Promise<void>
  plan: (assetIds: readonly string[], policy: SyncPolicy) => Promise<SyncPlan | null>
  clear: () => void
}

const IDLE = { busy: false, outcomes: [] }

/**
 * Moving assets between the project and the library, on request and never on its own.
 *
 * Deliberately the whole of the studio's sync policy: everything here starts with a click. The
 * planner underneath knows how to compute a two-way diff, and nothing calls it — see spec § 5,
 * which trades an automatic engine for two actions one can point at.
 */
export const useCloud = create<CloudState>()((set, get) => ({
  ...IDLE,

  push: async assetIds => {
    const bridge = getBridge()
    if (!bridge || get().busy || assetIds.length === 0) return

    set({ busy: true, outcomes: [] })
    try {
      const outcomes = await bridge.cloud.push(assetIds)
      set({ outcomes })
    } catch {
      // Reaching here means the boundary itself refused — a bad selection, or no project. What
      // failed per asset comes back in `outcomes`, not as a rejection.
      set({ outcomes: assetIds.map(assetId => ({ assetId, ok: false })) })
    } finally {
      set({ busy: false })
      // The rows carry their new sync state and their twin: what is on screen is now stale.
      useAssets.getState().invalidate()
    }
  },

  pull: async remoteAssetIds => {
    const bridge = getBridge()
    if (!bridge || get().busy || remoteAssetIds.length === 0) return

    set({ busy: true, outcomes: [] })
    try {
      set({ outcomes: await bridge.cloud.pull(remoteAssetIds) })
    } catch {
      // The boundary itself refused — a bad selection, or no project. What failed per asset
      // comes back in `outcomes`, exactly as it does for a push.
      set({ outcomes: remoteAssetIds.map(assetId => ({ assetId, ok: false })) })
    } finally {
      set({ busy: false })
      useAssets.getState().invalidate()
    }
  },

  plan: async (assetIds, policy) => {
    const bridge = getBridge()
    if (!bridge || assetIds.length === 0) return null

    return await bridge.cloud.plan(assetIds, policy)
  },

  clear: () => set(IDLE),
}))

/** How many of the last run went wrong — what a summary line reports without listing them. */
export function failedCount(state: Pick<CloudState, 'outcomes'>): number {
  return state.outcomes.filter(outcome => !outcome.ok).length
}
