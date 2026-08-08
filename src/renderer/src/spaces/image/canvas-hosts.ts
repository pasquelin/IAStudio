import type { LayerPixels } from '@/engines/canvas/CanvasEngine'

/** The engine, seen from the disk: it hands its pixels over, and takes them back. */
export type CanvasHost = {
  pixelSnapshots: () => Promise<LayerPixels[]>
  restoreSnapshot: (pixels: LayerPixels) => Promise<void>
}

/**
 * Which engine holds which document's pixels. `saveDocument` is called with an id and nothing
 * else — it has no way to reach into the `useRef` an `ImageDocument` keeps its engine in, and
 * the pixels never leave the side of the line the GPU context is on.
 *
 * The host is read at call time rather than captured, exactly as `pixelPort` reads it: a save can
 * land long after the engine that was open when the tab mounted has been replaced, and it is the
 * current one that holds the textures.
 */
const hosts = new Map<string, () => CanvasHost | null>()

/** Registers a document's engine. Returns the undo, for the effect that mounted it. */
export function holdCanvas(documentId: string, host: () => CanvasHost | null): () => void {
  hosts.set(documentId, host)
  return () => {
    // Only if it is still ours: a remount registers the new engine before the old effect cleans
    // up, and dropping the entry then would leave the live document unreachable.
    if (hosts.get(documentId) === host) hosts.delete(documentId)
  }
}

/** `null` when no image document by that id is open — every other kind, and a closed tab. */
export function canvasHost(documentId: string): CanvasHost | null {
  return hosts.get(documentId)?.() ?? null
}
