import type { Memory } from './assistantMemory'

/**
 * What one memory sits among, as SECTIONS a panel reads out — never as edges of a graph.
 *
 * 🛑 It was a tree, and the tree is why nobody could read it: a row said `«relation» · «label»`,
 * so the second level inherited its parent's word. « désigne · Scripts/Cam.ts » meant « this
 * memory is about that file », and « désigne · <another summary> » one line below meant « another
 * memory is about the same file » — the same word for two different things, which reads as though
 * the file designated the memory. Alban's verdict on 2026-08-28: « ça veut rien dire pour moi ».
 *
 * A section has a title that is a whole sentence, so a row never has to carry the relation.
 */

/** Which sentence titles a section. The panel owns the words; this owns the shape. */
export type MemoryTie = 'about' | 'links' | 'replaces'

export type MemoryNeighbour = {
  /** What the row reads: a reference as written, or another memory's own summary. */
  label: string
  /** The memory this row opens onto, or nothing for a row standing for a reference. */
  memoryId: string | null
  /**
   * Other memories about the SAME reference, which is the one nesting worth drawing: it is what
   * answers « what else does the assistant know about this file ». Empty everywhere else.
   */
  alsoAbout: readonly MemoryNeighbour[]
}

export type MemorySection = {
  tie: MemoryTie
  rows: readonly MemoryNeighbour[]
}

/**
 * One hop around the chosen memory, gathered by what ties it to each neighbour.
 *
 * 🛑 A section with no row is left out entirely rather than drawn empty: « Elle remplace » over
 * nothing tells a reader there is something to look for.
 */
export function neighboursOf(root: Memory, among: readonly Memory[]): readonly MemorySection[] {
  const sections: MemorySection[] = []

  const about = root.refs.map(ref => ({
    label: ref.ref,
    memoryId: null,
    alsoAbout: among
      .filter(
        one =>
          one.id !== root.id &&
          one.refs.some(held => held.kind === ref.kind && held.ref === ref.ref),
      )
      .map(one => ({ label: one.summary, memoryId: one.id, alsoAbout: [] })),
  }))
  if (about.length > 0) sections.push({ tie: 'about', rows: about })

  // A link may outlive its target — the id is all that is left of one that is gone.
  const links = root.links.map(id => byId(among, id))
  if (links.length > 0) sections.push({ tie: 'links', rows: links })

  if (root.supersedes) sections.push({ tie: 'replaces', rows: [byId(among, root.supersedes)] })

  return sections
}

function byId(among: readonly Memory[], id: string): MemoryNeighbour {
  const held = among.find(one => one.id === id)
  return { label: held?.summary ?? id, memoryId: held ? held.id : null, alsoAbout: [] }
}

/** One tie between two memories, for the whole-project view rather than the one-hop one. */
export type MemoryEdge = { from: string; to: string }

/**
 * Every memory of a scope, and what ties them — what a graph of the WHOLE project draws.
 *
 * 🛑 Two memories about one reference make ONE tie, not a star through the file: the file is not
 * a memory, and drawing it as a point would put half the graph's dots on things the assistant
 * never learned.
 *
 * What KIND of tie it is goes unsaid, deliberately: nothing draws it, and a pair tied both by a
 * shared file and by a link is one line either way.
 */
export function memoryEdgesOf(memories: readonly Memory[]): readonly MemoryEdge[] {
  const held = new Set(memories.map(one => one.id))
  const edges: MemoryEdge[] = []
  const seen = new Set<string>()

  const add = (from: string, to: string): void => {
    if (from === to || !held.has(from) || !held.has(to)) return

    // Compared rather than sorted — these are ids, and a locale has no business ordering them.
    const key = from < to ? `${from} ${to}` : `${to} ${from}`
    if (seen.has(key)) return

    seen.add(key)
    edges.push({ from, to })
  }

  const byRef = new Map<string, string[]>()
  for (const one of memories) {
    for (const ref of one.refs) {
      const key = `${ref.kind} ${ref.ref}`
      byRef.set(key, [...(byRef.get(key) ?? []), one.id])
    }
  }
  // A chain and not every pair: five memories on one file are four lines, not ten, and the eye
  // reads the cluster either way.
  for (const group of byRef.values()) {
    for (let i = 1; i < group.length; i += 1) add(group[i - 1] ?? '', group[i] ?? '')
  }

  for (const one of memories) {
    for (const linked of one.links) add(one.id, linked)
    if (one.supersedes) add(one.id, one.supersedes)
  }

  return edges
}
