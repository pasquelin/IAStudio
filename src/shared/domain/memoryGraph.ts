import type { Memory } from './assistantMemory'

/**
 * What one memory sits among, as rows a `Tree` draws.
 *
 * A tree and not a free node-and-link graph, and the plan states the compromise: a free layout
 * needs a placement module, and the studio's one precedent is lanes drawn by hand for a much
 * simpler case. One hop from the chosen memory is what makes it understood.
 */

export type MemoryRelation = 'ref' | 'link' | 'supersedes'

/**
 * One row. `parentId` is what `Tree` walks; `memoryId` is what selecting it opens — the row
 * detail moves to that memory, which is how one hop is walked without leaving the panel.
 */
export type MemoryRelationNode = {
  id: string
  parentId: string | null
  label: string
  relation: MemoryRelation | null
  /** The memory this row stands for, or nothing for a row standing for a reference. */
  memoryId: string | null
}

/**
 * The chosen memory, then what it points at, then what else points at the same thing.
 *
 * 🛑 One hop, and the root never appears under itself: a memory listed among its own neighbours
 * reads as a cycle to whoever is trying to see what it touches.
 */
export function relationsOf(root: Memory, among: readonly Memory[]): readonly MemoryRelationNode[] {
  const held = new Map(among.map(one => [one.id, one]))
  const rows: MemoryRelationNode[] = [
    { id: root.id, parentId: null, label: root.summary, relation: null, memoryId: root.id },
  ]

  for (const ref of root.refs) {
    const refId = `${root.id} ${ref.kind} ${ref.ref}`
    rows.push({ id: refId, parentId: root.id, label: ref.ref, relation: 'ref', memoryId: null })

    for (const other of among) {
      if (other.id === root.id) continue
      if (!other.refs.some(one => one.kind === ref.kind && one.ref === ref.ref)) continue

      rows.push({
        id: `${refId} ${other.id}`,
        parentId: refId,
        label: other.summary,
        relation: 'ref',
        memoryId: other.id,
      })
    }
  }

  for (const linked of root.links) {
    const other = held.get(linked)
    rows.push({
      id: `${root.id} link ${linked}`,
      parentId: root.id,
      // A link may outlive its target — the id is all that is left of one that is gone.
      label: other?.summary ?? linked,
      relation: 'link',
      memoryId: other ? other.id : null,
    })
  }

  if (root.supersedes) {
    const replaced = held.get(root.supersedes)
    rows.push({
      id: `${root.id} was ${root.supersedes}`,
      parentId: root.id,
      label: replaced?.summary ?? root.supersedes,
      relation: 'supersedes',
      memoryId: replaced ? replaced.id : null,
    })
  }

  return rows
}

/**
 * The memory a row opens onto — nothing for a row standing for a file, nothing for the root.
 *
 * 🛑 Here and not in the panel: its `Tree` is virtualised, and jsdom measures every row at zero,
 * so a decision left in there is one no test can reach.
 */
export function openedBy(
  rows: readonly MemoryRelationNode[],
  rowId: string,
  rootId: string,
): string | null {
  const opens = rows.find(one => one.id === rowId)?.memoryId ?? null
  return opens === rootId ? null : opens
}
