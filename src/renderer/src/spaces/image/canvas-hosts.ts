/** The engine, seen from outside React: the one thing it is asked is to take a picture. */
export type CanvasHost = { loadInto: (layerId: string, url: string) => Promise<void> }

/**
 * The mounted engine of each image document.
 *
 * A dropped asset and a finished generation both land outside the component that holds the
 * engine in a ref, and neither can reach it through the store — pixels are not state. So the
 * document registers itself while it is mounted, exactly as long as its GPU context lives.
 */
const hosts = new Map<string, CanvasHost>()

/** Returns the unregister, so the effect that mounted the engine is the one that lets it go. */
export function registerCanvas(documentId: string, host: CanvasHost): () => void {
  hosts.set(documentId, host)
  return () => {
    // Only if it is still ours: a remount registers the new engine before the old effect cleans
    // up, and dropping the entry then would leave the live document unreachable.
    if (hosts.get(documentId) === host) hosts.delete(documentId)
  }
}

/** `null` when the tab is closed, or hidden before it ever mounted. */
export function canvasHostOf(documentId: string): CanvasHost | null {
  return hosts.get(documentId) ?? null
}
