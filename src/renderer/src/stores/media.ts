import { create } from 'zustand'
import type { IngestProgress, IngestStage, MediaCapabilities } from '@shared/domain/media'
import { getBridge } from '@/services/bridge'
import { useAssets } from './assets'

type MediaState = {
  /** Running ingests, by asset id. A finished one leaves; a failed one stays to be seen. */
  progress: Record<string, IngestProgress>
  capabilities: MediaCapabilities

  /** Reads what the pipeline can do and follows every ingest. Returns the unsubscribe. */
  connect: () => Promise<() => void>
  /** Asks again, after the ffmpeg path was changed — the answer is what that field decides. */
  refreshCapabilities: () => Promise<void>
  importMedia: () => Promise<void>
  cancel: (assetId: string) => Promise<void>
  apply: (progress: IngestProgress) => void
}

/** Stages that end an ingest. A failure stays on screen — it is the only trace it left. */
const FINISHED: readonly IngestStage[] = ['done', 'cancelled']

/**
 * One catalogue read for a batch rather than one per file. `assets.search` is a synchronous
 * SQLite query in the main process, and forty rushes finishing would freeze every window forty
 * times over.
 */
let pending: ReturnType<typeof setTimeout> | null = null

function refreshSoon(): void {
  if (pending) clearTimeout(pending)
  pending = setTimeout(() => {
    pending = null
    void useAssets.getState().refresh()
  }, 200)
}

const without = (
  progress: Record<string, IngestProgress>,
  assetId: string,
): Record<string, IngestProgress> =>
  Object.fromEntries(Object.entries(progress).filter(([id]) => id !== assetId))

/**
 * Ingest lives in the main process; this replica is what lets the asset browser show a file the
 * moment it is linked, and follow the probing that fills in its duration afterwards.
 */
export const useMedia = create<MediaState>()((set, get) => ({
  progress: {},
  capabilities: { ffmpeg: true },

  connect: async () => {
    const bridge = getBridge()
    if (!bridge) return () => {}

    const stop = bridge.media.onProgress(progress => get().apply(progress))
    await get().refreshCapabilities()
    return stop
  },

  refreshCapabilities: async () => {
    const capabilities = await getBridge()?.media.capabilities()
    if (capabilities) set({ capabilities })
  },

  importMedia: async () => {
    try {
      const imported = await getBridge()?.media.ingest()
      // The rows exist as soon as the dialog closes, probe or no probe: the browser shows the
      // file straight away, and the ingest fills in what it learns.
      if (imported?.length) await useAssets.getState().refresh()
    } catch {
      // The project was closed while the picker was open: nothing was linked, and there is
      // nothing to say beyond leaving the browser as it was.
    }
  },

  cancel: async assetId => {
    // Dropped locally too: the main process answers with a `cancelled` event, and waiting for
    // it would leave the row on screen under a button that already did its job.
    set(state => ({ progress: without(state.progress, assetId) }))
    await getBridge()?.media.cancel(assetId)
  },

  apply: progress => {
    // The duration, the proxy and the waveform are all known only now.
    if (progress.stage === 'done') refreshSoon()

    set(state =>
      FINISHED.includes(progress.stage)
        ? { progress: without(state.progress, progress.assetId) }
        : { progress: { ...state.progress, [progress.assetId]: progress } },
    )
  },
}))
