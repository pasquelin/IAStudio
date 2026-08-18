import type { LayerPixels } from '@/engines/canvas/CanvasEngine'
import { createHostRegistry } from '@/helpers/hostRegistry'

/** The engine, seen from the disk: it hands its pixels over, and takes them back. */
export type CanvasHost = {
  pixelSnapshots: () => Promise<LayerPixels[]>
  restoreSnapshot: (pixels: LayerPixels) => Promise<void>
  /**
   * The stack composited into one picture, as bytes — `mergedimage.png`, which the container
   * requires and every other application draws of a `.ora`.
   */
  flatten: () => Promise<Uint8Array<ArrayBuffer> | null>
  /**
   * The same picture, base64 — what a PNG asset and the API take.
   *
   * The engine has had it all along; the port had no reason to publish it until a save had to
   * reach the asset as well as the document. It is the same pass the screen shows, so what
   * lands on disk is what was judged.
   */
  snapshot: () => Promise<string | null>
  /**
   * Forgets a picture the loader had cached, once its asset has been rewritten.
   *
   * On the port because the loader's cache is global to the window while an engine is the only
   * thing that holds it — and a rewrite only ever happens where one is mounted, since it is that
   * engine's own `snapshot` that produced the bytes.
   */
  forgetPicture: (assetId: string) => Promise<void>
}

const registry = createHostRegistry<CanvasHost>()

/** Registers a document's engine. Returns the undo, for the effect that mounted it. */
export const holdCanvas = registry.hold

/** `null` when no image document by that id is open — every other kind, and a closed tab. */
export const canvasHost = registry.get
