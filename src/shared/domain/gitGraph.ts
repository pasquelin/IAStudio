/**
 * Where each commit's dot sits, and which lines join them.
 *
 * Arithmetic over a list of hashes and parents, and nothing else — no DOM, no SVG, no colours.
 * That separation is the same one the sound and the timeline keep in this repository, and for the
 * same reason: what is hard here is the placement, and the placement is what a test can hold.
 */
import type { GitCommit } from './git'

export type GitLink = {
  /** Column the line enters this row from, above. */
  from: number
  /** Column it leaves by, below. */
  to: number
}

export type GitLaneRow = {
  hash: string
  /** Column the commit's own dot sits in. */
  lane: number
  /** Every line crossing this row, the commit's own included. */
  links: readonly GitLink[]
  /** Columns in use across the whole log — what the drawing reserves width for. */
  width: number
}

/**
 * The graph, laid out one row per commit.
 *
 * Fed the log in the order git wrote it — newest first, which is also child before parent — and
 * that order is what makes one pass enough: a commit is always reached before the commits it
 * came from, so a lane can be reserved for a parent at the moment its child is placed.
 *
 * A lane holds the hash it is WAITING for. Placing a commit means finding the lane that was
 * waiting for it, then handing that lane over to its first parent; the other parents of a merge
 * take lanes of their own. Two branches meeting again is the case worth stating: several lanes
 * can be waiting for the same commit, and all but the first are freed on the spot — otherwise a
 * merged branch would leave an empty column running down the rest of the history.
 *
 * `width` is the same on every row on purpose. A graph whose column count changed per row would
 * shift every message sideways as one scrolls, which is exactly what one is reading.
 */
export function laneLayout(commits: readonly GitCommit[]): GitLaneRow[] {
  /** What each lane is waiting for, or nothing where the lane is free. */
  const waiting: (string | null)[] = []
  const rows: GitLaneRow[] = []
  let width = 0

  for (const commit of commits) {
    const claimed = waiting.flatMap((hash, lane) => (hash === commit.hash ? [lane] : []))
    const lane = claimed[0] ?? free(waiting)
    const links: GitLink[] = []

    // Branches that come back together. The dot is drawn once, in the first lane that was
    // waiting; the others end here, and their columns are given back.
    for (const merged of claimed.slice(1)) {
      links.push({ from: merged, to: lane })
      waiting[merged] = null
    }

    // Every other lane simply carries on down the row, and has to be drawn doing so — a line
    // that stopped being emitted for one row would break in the middle of the graph.
    for (const [index, hash] of waiting.entries()) {
      if (hash !== null && index !== lane && !claimed.includes(index)) {
        links.push({ from: index, to: index })
      }
    }

    const [first, ...rest] = commit.parents
    waiting[lane] = first ?? null
    if (first !== undefined) links.push({ from: lane, to: lane })

    for (const parent of rest) {
      const already = waiting.indexOf(parent)
      const target = already === -1 ? free(waiting) : already
      waiting[target] = parent
      links.push({ from: lane, to: target })
    }

    width = Math.max(width, waiting.length, lane + 1)
    rows.push({ hash: commit.hash, lane, links, width: 0 })
  }

  // Written back once the whole log is known: a row cannot say how wide the graph is while there
  // are commits below it that have not been placed.
  return rows.map(row => ({ ...row, width }))
}

/** The leftmost lane nothing is waiting in, extending the row when they are all taken. */
function free(waiting: (string | null)[]): number {
  const empty = waiting.indexOf(null)
  if (empty !== -1) return empty

  waiting.push(null)
  return waiting.length - 1
}
