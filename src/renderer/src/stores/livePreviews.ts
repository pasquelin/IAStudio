import { create } from 'zustand'

type LivePreview = {
  /** What the editor last drew. Never encoded — see `CanvasEngine.flattenBitmap`. */
  bitmap: ImageBitmap
  /** Bumped on every publish, so a slot holding this asset knows to ask again. */
  version: number
}

type LivePreviewsState = {
  previews: ReadonlyMap<string, LivePreview>
  /** Replaces what this asset shows in every viewport of the window, and frees what it replaces. */
  publishPreview: (assetId: string, bitmap: ImageBitmap) => void
  /** Gives the asset back to its file. Called when the tab closes, and when a save lands. */
  revokePreview: (assetId: string) => void
}

/**
 * What an OPEN EDITOR is showing of an asset, before anything has been written to disk.
 *
 * A preview is a state of the WINDOW, never of a document: nothing here is saved, nothing here is
 * exported, and closing the tab that published it gives the asset back to its file. That is what
 * keeps « what I see » from drifting away from « what a file holds » without a way back.
 *
 * Affordable because it is not encoded: 1029 ms to make a PNG of a 2048², 0.3 to wrap the very
 * same canvas as an `ImageBitmap`, measured on this machine.
 */
export const useLivePreviews = create<LivePreviewsState>()((set, get) => ({
  previews: new Map(),

  publishPreview: (assetId, bitmap) => {
    const previews = new Map(get().previews)
    // Closed, never dropped: an `ImageBitmap` holds pixels the garbage collector will not hurry
    // to release, and a stroke a second would pile up a canvas each time.
    previews.get(assetId)?.bitmap.close()
    previews.set(assetId, { bitmap, version: (previews.get(assetId)?.version ?? 0) + 1 })
    set({ previews })
  },

  revokePreview: assetId => {
    const held = get().previews.get(assetId)
    if (!held) return

    held.bitmap.close()
    const previews = new Map(get().previews)
    previews.delete(assetId)
    set({ previews })
  },
}))

/** What an editor is showing of this asset, or nothing when none is. */
export function livePreviewOf(assetId: string): ImageBitmap | null {
  return useLivePreviews.getState().previews.get(assetId)?.bitmap ?? null
}

/**
 * How many times an editor has published this asset — folded into the version a texture slot
 * compares, so a fresh preview reloads the same way a fresh file does.
 */
export function livePreviewVersionOf(assetId: string): number {
  return useLivePreviews.getState().previews.get(assetId)?.version ?? 0
}
