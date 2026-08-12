import type { LayerPixels } from '@/engines/canvas/CanvasEngine'
import { createHostRegistry } from '@/helpers/host-registry'

/** The engine, seen from the disk: it hands its pixels over, and takes them back. */
export type CanvasHost = {
  pixelSnapshots: () => Promise<LayerPixels[]>
  restoreSnapshot: (pixels: LayerPixels) => Promise<void>
  /**
   * The stack composited into one picture, base64 — what the asset behind the document holds.
   *
   * The engine has had it all along; the port had no reason to publish it until a save had to
   * reach the asset as well as the document. It is the same pass the screen shows, so what
   * lands on disk is what was judged.
   */
  snapshot: () => Promise<string | null>
}

const registry = createHostRegistry<CanvasHost>()

/** Registers a document's engine. Returns the undo, for the effect that mounted it. */
export const holdCanvas = registry.hold

/** `null` when no image document by that id is open — every other kind, and a closed tab. */
export const canvasHost = registry.get
