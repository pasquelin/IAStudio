import { paintPixels } from '@/engines/canvas/commands'
import type { PatchSide } from '@/engines/canvas/PixelPatches'
import { useCanvases } from '@/stores/canvases'

/** The engine, seen from the history: the one thing it is asked to do is replay a patch. */
export type PixelHost = { restorePixels: (patchId: string, side: PatchSide) => boolean }

export type PixelPortActions = {
  /** A finished stroke becomes a history entry that knows which patch undoes it. */
  record: (patchId: string) => void
  /** Its tiles are gone: the entry has to leave the stack rather than sit there doing nothing. */
  drop: (patchId: string) => void
}

/**
 * The bridge between a finished stroke and the document's history. The patch id is all that
 * crosses: the tiles stay on the engine's side, where the GPU context that owns them is.
 *
 * `host` is read at call time rather than captured — an undo can land long after the engine that
 * recorded the patch was replaced, and the current one is the one holding the textures.
 */
export function pixelPort(documentId: string, host: () => PixelHost | null): PixelPortActions {
  const store = () => useCanvases.getState()
  const restore = (patchId: string, side: PatchSide): boolean =>
    host()?.restorePixels(patchId, side) ?? false
  // Deferred, because this is answered from inside the store's own apply: cutting the stack
  // there would be a `set` within a `set`, and the entry being replayed is still on it.
  const lost = (patchId: string): void =>
    queueMicrotask(() => store().forgetThrough(documentId, `pixels:${patchId}`))

  return {
    record: patchId => store().runCommand(documentId, paintPixels(patchId, { restore, lost })),
    drop: patchId => store().forgetThrough(documentId, `pixels:${patchId}`),
  }
}
