/** The editor, seen from the disk: it hands back the take as the chain has rendered it. */
export type AudioHost = {
  /** 16-bit PCM WAV, or `null` while the worker is still replaying the chain. */
  rendered: () => Uint8Array | null
}

/**
 * Which editor holds which document's rendered take.
 *
 * The same registry `canvasHost` is, for the same reason: `saveDocument` is called with an id and
 * nothing else, and the render lives in an `AudioDocument`'s state — reachable from a component
 * and from nowhere else. The chain is replayed in a worker, so what is registered here is a
 * getter, read at call time: a save can land long after the render it was opened with.
 */
const hosts = new Map<string, () => AudioHost | null>()

/** Registers a document's editor. Returns the undo, for the effect that mounted it. */
export function holdAudio(documentId: string, host: () => AudioHost | null): () => void {
  hosts.set(documentId, host)
  return () => {
    // Only if it is still ours: a remount registers the new editor before the old effect cleans
    // up, and dropping the entry then would leave the live document unreachable.
    if (hosts.get(documentId) === host) hosts.delete(documentId)
  }
}

/** `null` when no audio document by that id is open — every other kind, and a closed tab. */
export function audioHost(documentId: string): AudioHost | null {
  return hosts.get(documentId)?.() ?? null
}
