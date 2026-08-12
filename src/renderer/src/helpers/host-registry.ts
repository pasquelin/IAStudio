/**
 * Which editor holds which document's live state, for the code that only has an id.
 *
 * `saveDocument` is called with a document id and nothing else: it has no way to reach into the
 * `useRef` a component keeps its engine in, and the pixels of a canvas never leave the side of
 * the line the GPU context is on. Each space registers a GETTER, read at call time — a save can
 * land long after the engine that was open when the tab mounted has been replaced, and it is the
 * current one that holds the state.
 *
 * Written once because the second space to need it copied the first: the guard below is the part
 * worth having in one place, and it is exactly the part a copy gets wrong.
 */
export type HostRegistry<H> = {
  /** Registers a document's host. Returns the undo, for the effect that mounted it. */
  hold: (documentId: string, host: () => H | null) => () => void
  /** `null` when no document of this kind by that id is open — every other kind, and a closed tab. */
  get: (documentId: string) => H | null
}

export function createHostRegistry<H>(): HostRegistry<H> {
  const hosts = new Map<string, () => H | null>()

  return {
    hold: (documentId, host) => {
      hosts.set(documentId, host)
      return () => {
        // Only if it is still ours: a remount registers the new host before the old effect
        // cleans up, and dropping the entry then would leave the live document unreachable.
        if (hosts.get(documentId) === host) hosts.delete(documentId)
      }
    },
    get: documentId => hosts.get(documentId)?.() ?? null,
  }
}
