import type { Memory, MemoryRef } from '@shared/domain/assistantMemory'
import { MEMORY_IMPORTANCE_MAX, MEMORY_IMPORTANCE_MIN } from '@shared/domain/assistantMemory'

/**
 * How a memory is ranked against what was asked. Pure, so the weights can be argued about on a
 * fixed set — without a model, a process or a database. Four voices because each answers what the
 * others cannot: an exact name is found by words alone, a question by meaning alone.
 */

/**
 * 🛑 Not tuned against a benchmark — there is none. What makes them defensible is that
 * `recallScore.test.ts` states the ORDER each is there to produce.
 */
const RECALL_WEIGHTS = {
  /** What the open scene or the open script is about. The strongest: it is not a guess. */
  anchored: 1,
  /** Words that matched. Strong, and it is the only voice that answers an exact name. */
  exact: 0.9,
  /** Meaning that matched. Weaker per point, and the only voice that answers a question. */
  similar: 0.7,
  /** What the person or a rule judged it worth. A tiebreak, never a ranking of its own. */
  importance: 0.25,
  /** How lately it was of use. The smallest, so a stale answer is not preferred to a right one. */
  recency: 0.15,
}

/** After how long unused a memory has lost half its recency. A season of a project. */
const RECALL_HALF_LIFE_DAYS = 30

const DAY_MS = 86_400_000

/** One candidate and everything known about it, gathered by `recall` and scored here. */
export type RecallCandidate = {
  memory: Memory
  /** Zero-based. A RANK, not bm25: the two drivers of the port promise no common scale. */
  exactRank?: number
  /** How alike its vector and the question's are, in [-1, 1]. Nothing where neither has one. */
  similarity?: number
}

export type RecallFocus = {
  /** What is on screen — the open scene, the open script, the selected object. */
  refs?: readonly MemoryRef[]
  /** When the ranking is being done, so recency is a fact rather than a wall clock. */
  now: string
}

export type RecallScored = {
  memory: Memory
  score: number
}

/** `[0, 1]`, first place worth one and falling away — a rank has no scale of its own. */
const fromRank = (rank: number | undefined): number => (rank === undefined ? 0 : 1 / (1 + rank))

/** `[0, 1]` from a cosine. Below zero is « nothing alike », which is what zero already says. */
const fromSimilarity = (similarity: number | undefined): number =>
  similarity === undefined ? 0 : Math.max(0, similarity)

const fromImportance = (importance: number): number =>
  (Math.min(MEMORY_IMPORTANCE_MAX, Math.max(MEMORY_IMPORTANCE_MIN, importance)) -
    MEMORY_IMPORTANCE_MIN) /
  (MEMORY_IMPORTANCE_MAX - MEMORY_IMPORTANCE_MIN)

/** Halving every `RECALL_HALF_LIFE_DAYS`. From `createdAt` until served: new is not stale. */
function fromRecency(memory: Memory, now: string): number {
  const at = Date.parse(memory.usedAt ?? memory.createdAt)
  const asked = Date.parse(now)
  if (Number.isNaN(at) || Number.isNaN(asked)) return 0

  const days = Math.max(0, (asked - at) / DAY_MS)
  return 2 ** (-days / RECALL_HALF_LIFE_DAYS)
}

const anchoredIn = (memory: Memory, focus: readonly MemoryRef[]): boolean =>
  memory.refs.some(one => focus.some(want => want.kind === one.kind && want.ref === one.ref))

export function scoreOf(candidate: RecallCandidate, focus: RecallFocus): number {
  const { memory } = candidate

  return (
    RECALL_WEIGHTS.anchored * (anchoredIn(memory, focus.refs ?? []) ? 1 : 0) +
    RECALL_WEIGHTS.exact * fromRank(candidate.exactRank) +
    RECALL_WEIGHTS.similar * fromSimilarity(candidate.similarity) +
    RECALL_WEIGHTS.importance * fromImportance(memory.importance) +
    RECALL_WEIGHTS.recency * fromRecency(memory, focus.now)
  )
}

/**
 * Best first, pinned ahead of everything: what the person decided to always give is not something
 * a score may rank away. `id` breaks a tie, so a panel does not redraw its rows for no reason.
 */
export function rankedRecall(
  candidates: readonly RecallCandidate[],
  focus: RecallFocus,
): readonly RecallScored[] {
  const scored = candidates.map(candidate => ({
    memory: candidate.memory,
    score: scoreOf(candidate, focus),
  }))

  return scored.sort((one, other) => {
    const pinned = Number(other.memory.state === 'pinned') - Number(one.memory.state === 'pinned')
    if (pinned !== 0) return pinned
    if (other.score !== one.score) return other.score - one.score

    return one.memory.id < other.memory.id ? -1 : 1
  })
}

/**
 * 🛑 Cut by WHOLE memories: a decision truncated reads as a different decision, which is worse
 * than one missing. Too long for what is left is passed over, never stopped at — the list is
 * ranked, and one long summary is no reason to drop the shorter ones behind it.
 */
export function recalledWithin(ranked: readonly RecallScored[], room: number): readonly Memory[] {
  const kept: Memory[] = []
  let left = room

  for (const one of ranked) {
    const cost = one.memory.summary.length + 1
    if (cost > left) continue
    left -= cost
    kept.push(one.memory)
  }

  return kept
}
