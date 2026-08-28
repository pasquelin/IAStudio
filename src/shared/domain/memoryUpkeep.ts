import { byCodeUnit, searchWords } from '../text'
import type { Memory } from './assistantMemory'

/**
 * What a memory of six months needs so it stays readable: what says the same thing twice, and
 * what nothing has drawn on for a season.
 *
 * Pure, and in `shared/` because both sides ask — the panel offers the gestures, the store
 * carries them out. A second copy would let the two disagree about what a duplicate is.
 */

/** Loose enough to catch a rewording, strict enough not to merge two: the studio's own folding. */
const plainly = (summary: string): string => searchWords(summary).join(' ')

/** Closed by `id`, so two memories written in the same breath come back in one order. */
const byWorthKeeping = (one: Memory, other: Memory): number => {
  if (one.importance !== other.importance) return other.importance - one.importance
  if (one.createdAt !== other.createdAt) return byCodeUnit(other.createdAt, one.createdAt)

  return byCodeUnit(one.id, other.id)
}

/**
 * Memories saying the same thing, grouped — the KEEPER first, the rest behind it.
 *
 * The keeper is the most important, then the most recent: importance is what somebody decided,
 * where a date is only what happened last. Groups of one are left out.
 */
export function duplicatesIn(memories: readonly Memory[]): readonly (readonly Memory[])[] {
  const bySaying = new Map<string, Memory[]>()

  for (const memory of memories) {
    // 🛑 `live` alone. Archived ones are already set aside, and grouping them made merging
    // endless: the panel lists them, so the same group came back with the count unchanged.
    // Pinned ones are a decision to always give them — see `staleIn`.
    if (memory.state !== 'live') continue

    const saying = `${memory.type} ${plainly(memory.summary)}`
    const held = bySaying.get(saying) ?? []
    held.push(memory)
    bySaying.set(saying, held)
  }

  return [...bySaying.values()]
    .filter(group => group.length > 1)
    .map(group => [...group].sort(byWorthKeeping))
}

/** After how long unused a memory is offered for archiving. Two seasons of a project. */
export const MEMORY_STALE_DAYS = 180

const DAY_MS = 86_400_000

const lastTouched = (memory: Memory): string => memory.usedAt ?? memory.createdAt

/**
 * Live memories nothing has drawn on for a long time, oldest first.
 *
 * 🛑 Pinned ones are never here: what the person decided to always give does not go stale, and
 * offering to archive it would undo a decision rather than tidy after one.
 */
export function staleIn(
  memories: readonly Memory[],
  now: string,
  afterDays = MEMORY_STALE_DAYS,
): readonly Memory[] {
  const asked = Date.parse(now)
  if (Number.isNaN(asked)) return []

  return memories
    .filter(memory => memory.state === 'live')
    .filter(memory => {
      const at = Date.parse(lastTouched(memory))
      return !Number.isNaN(at) && asked - at > afterDays * DAY_MS
    })
    .sort((one, other) => byCodeUnit(lastTouched(one), lastTouched(other)))
}
