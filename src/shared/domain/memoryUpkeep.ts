import { byCodeUnit, searchWords } from '../text'
import type { Memory } from './assistantMemory'

/**
 * What a memory of six months needs so it stays readable: what says the same thing twice, and
 * what nothing has drawn on for a season.
 *
 * Pure, and in `shared/` so the window and the main process cannot disagree about what a
 * duplicate is. Both importers are in the renderer today; the definition is not the renderer's.
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
type Saying = { type: Memory['type']; summary: string }

/**
 * 🛑 What « these two say the same thing » MEANS, spelt once: a duplicate and an already-said
 * answering differently would have a promotion mint what the merge then refuses to see.
 */
const sayingOf = (one: Saying): string => `${one.type} ${plainly(one.summary)}`

export function duplicatesIn(memories: readonly Memory[]): readonly (readonly Memory[])[] {
  const bySaying = new Map<string, Memory[]>()

  for (const memory of memories) {
    // 🛑 `live` alone. Archived ones are already set aside, and grouping them made merging
    // endless: the panel lists them, so the same group came back with the count unchanged.
    // Pinned ones are a decision to always give them — see `staleIn`.
    if (memory.state !== 'live') continue

    const saying = sayingOf(memory)
    const held = bySaying.get(saying) ?? []
    held.push(memory)
    bySaying.set(saying, held)
  }

  return [...bySaying.values()]
    .filter(group => group.length > 1)
    .map(group => [...group].sort(byWorthKeeping))
}

/**
 * Whether one of these already says what a draft says — same type, same wording.
 *
 * The same judgement `duplicatesIn` makes, exported because promoting a memory to the machine's
 * own asks it of a list the panel is not showing: clicking twice must add nothing the second time.
 */
export function alreadySaid(memories: readonly Memory[], draft: Saying): boolean {
  const saying = sayingOf(draft)

  return memories.some(one => sayingOf(one) === saying)
}

/** After how long unused a memory is offered for archiving. Two seasons of a project. */
const MEMORY_STALE_DAYS = 180

const DAY_MS = 86_400_000

const lastTouched = (memory: Memory): string => memory.usedAt ?? memory.createdAt

/**
 * Live memories nothing has drawn on for a long time, oldest first.
 *
 * 🛑 Pinned ones are never here: what the person decided to always give does not go stale, and
 * offering to archive it would undo a decision rather than tidy after one.
 */
export function staleIn(memories: readonly Memory[], now: string): readonly Memory[] {
  const asked = Date.parse(now)
  if (Number.isNaN(asked)) return []

  return memories
    .filter(memory => memory.state === 'live')
    .filter(memory => {
      const at = Date.parse(lastTouched(memory))
      return !Number.isNaN(at) && asked - at > MEMORY_STALE_DAYS * DAY_MS
    })
    .sort((one, other) => byCodeUnit(lastTouched(one), lastTouched(other)))
}
