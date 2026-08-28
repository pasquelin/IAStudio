import { z } from 'zod'
import { defined } from '@shared/guards'
import {
  MEMORY_BODY_MAX,
  MEMORY_PAGE,
  MEMORY_IMPORTANCE_MAX,
  MEMORY_IMPORTANCE_MIN,
  MEMORY_REF_KINDS,
  MEMORY_SOURCE_KINDS,
  MEMORY_STATES,
  MEMORY_SUMMARY_MAX,
  MEMORY_SCOPES,
  MEMORY_TYPES,
  type Memory,
  type MemoryDraft,
  type MemoryPatch,
  type MemoryQuery,
  type MemoryRecallAsk,
  type MemoryScope,
} from '@shared/domain/assistantMemory'

/**
 * What a line of the file, or a caller across the boundary, is held to.
 *
 * A line is checked on its own and never as part of the file: one unreadable line costs that
 * memory, not every memory written after it. That is the whole reason the file is one JSON
 * object per line rather than one array.
 */

const memoryRef = z.object({
  kind: z.enum(MEMORY_REF_KINDS),
  ref: z.string().min(1),
})

const memorySource = z.object({
  kind: z.enum(MEMORY_SOURCE_KINDS),
  ref: z.string().min(1).optional(),
})

/**
 * 🛑 `v` is deliberately NOT declared here — zod strips what a schema does not name, and it is a
 * fact about the FILE rather than about what was remembered. `versionOf` is what checks it, and
 * a line is refused on its version before it ever reaches this.
 */
const storedMemory = z.object({
  id: z.string().min(1),
  type: z.enum(MEMORY_TYPES),
  summary: z.string().trim().min(1).max(MEMORY_SUMMARY_MAX),
  body: z.string().max(MEMORY_BODY_MAX).default(''),
  importance: z.number().int().min(MEMORY_IMPORTANCE_MIN).max(MEMORY_IMPORTANCE_MAX),
  createdAt: z.string().min(1),
  usedAt: z.string().min(1).optional(),
  source: memorySource,
  refs: z.array(memoryRef).default([]),
  links: z.array(z.string().min(1)).default([]),
  state: z.enum(MEMORY_STATES),
  supersedes: z.string().min(1).optional(),
})

/** What a window, or a program driving the studio, asks to remember. */
const memoryDraft = z.object({
  type: z.enum(MEMORY_TYPES),
  summary: z.string().trim().min(1).max(MEMORY_SUMMARY_MAX),
  body: z.string().max(MEMORY_BODY_MAX).optional(),
  importance: z.number().int().min(MEMORY_IMPORTANCE_MIN).max(MEMORY_IMPORTANCE_MAX),
  source: memorySource,
  refs: z.array(memoryRef).optional(),
  links: z.array(z.string().min(1)).optional(),
  state: z.enum(MEMORY_STATES).optional(),
})

const memoryPatch = z.object({
  type: z.enum(MEMORY_TYPES).optional(),
  summary: z.string().trim().min(1).max(MEMORY_SUMMARY_MAX).optional(),
  body: z.string().max(MEMORY_BODY_MAX).optional(),
  importance: z.number().int().min(MEMORY_IMPORTANCE_MIN).max(MEMORY_IMPORTANCE_MAX).optional(),
  refs: z.array(memoryRef).optional(),
  links: z.array(z.string().min(1)).optional(),
  state: z.enum(MEMORY_STATES).optional(),
})

/** Bounded here rather than trusted: a window asking for every memory at once is a frozen window. */
const memoryQuery = z.object({
  text: z.string().optional(),
  types: z.array(z.enum(MEMORY_TYPES)).optional(),
  states: z.array(z.enum(MEMORY_STATES)).optional(),
  refs: z.array(memoryRef).optional(),
  limit: z.number().int().min(1).max(MEMORY_PAGE).optional(),
})

export function parseMemoryDraft(value: unknown): MemoryDraft {
  return memoryDraft.parse(value)
}

/**
 * 🛑 `defined` and not the parsed object: zod KEEPS a key that arrived as an explicit
 * `undefined`, and structured clone carries it across the boundary. Measured — a patch of
 * `{summary: undefined, state: 'archived'}` wrote a summary-less line to the append-only file,
 * THEN threw on binding it, so the amendment was lost and every later read of that project
 * answered `trouble: 'unreadable'` for good.
 */
export function parseMemoryPatch(value: unknown): MemoryPatch {
  return defined(memoryPatch.parse(value))
}

export function parseMemoryQuery(value: unknown): MemoryQuery {
  return memoryQuery.parse(value)
}

/** A question, bounded like a query: what ranks the answers costs a comparison per memory. */
const memoryRecallAsk = z.object({
  text: z.string().min(1),
  refs: z.array(memoryRef).optional(),
  limit: z.number().int().min(1).max(MEMORY_PAGE).optional(),
})

export function parseMemoryRecallAsk(value: unknown): MemoryRecallAsk {
  return memoryRecallAsk.parse(value)
}

const memoryScope = z.enum(MEMORY_SCOPES)

export function parseMemoryScope(value: unknown): MemoryScope {
  return memoryScope.parse(value)
}

/**
 * 🛑 Built once, at the module. Inside the function it was rebuilt per LINE, and reading a file
 * of ten thousand took 1 177 ms against 60,6 — nineteen times, measured, on the one path that
 * stands between opening a project and answering its first question.
 */
const declaredVersion = z.object({ v: z.number().int().min(1) })

/**
 * The version a line declares, or nothing. A line with no version is not a line of this file:
 * every one the studio writes carries it.
 */
export function versionOf(value: unknown): number | null {
  const version = declaredVersion.safeParse(value)
  return version.success ? version.data.v : null
}

/**
 * One line back as a memory, or nothing. `null` rather than a throw: a caller reading a file of
 * a thousand lines needs the nine hundred and ninety-nine that are fine.
 */
export function parseMemory(value: unknown): Memory | null {
  const parsed = storedMemory.safeParse(value)
  return parsed.success ? parsed.data : null
}
