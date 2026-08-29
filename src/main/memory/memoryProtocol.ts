import type { MemoryDraft, MemoryPatch, MemoryQuery } from '@shared/domain/assistantMemory'
import { isRecord } from '@shared/guards'
import type { ThreadReady } from '@main/threadReady'
import type { RecallAsk } from './memoryIndex'
import type { MemoryStore } from './memoryStore'
import type { MemoryVector } from './vectors'

/**
 * What the main process and the memory thread say to each other.
 *
 * The store is untouched and runs whole on the other side of this: `better-sqlite3` blocks the
 * thread it runs on and the main thread owns every window (CLAUDE.md, invariant 6). Reading the
 * file back is the operation that makes it worth a thread of its own — a project with years of
 * history is thousands of lines parsed and inserted.
 */

export type MemoryRequest =
  | { id: number; op: 'remember'; draft: MemoryDraft }
  | { id: number; op: 'amend'; memoryId: string; patch: MemoryPatch }
  | { id: number; op: 'forget'; memoryId: string }
  | { id: number; op: 'read'; memoryId: string }
  | { id: number; op: 'list'; query: MemoryQuery }
  /** How many memories stand, without reading one — see `AsyncMemory.count`. */
  | { id: number; op: 'count' }
  | { id: number; op: 'markUsed'; ids: readonly string[] }
  | { id: number; op: 'rebuild' }
  | { id: number; op: 'refresh' }
  | { id: number; op: 'compact' }
  | { id: number; op: 'reset' }
  | { id: number; op: 'trouble' }
  | { id: number; op: 'recall'; ask: RecallAsk }
  | { id: number; op: 'writeVectors'; vectors: readonly MemoryVector[] }
  | { id: number; op: 'withoutVector'; model: string; limit: number }
  | { id: number; op: 'pendingVectors'; model: string }
  | { id: number; op: 'dropOtherVectors'; model: string }
  /** Settles what is queued and shuts the database. Answered BEFORE the thread is terminated. */
  | { id: number; op: 'close' }

/** What each operation answers, so the client types its promise without a cast. */
export type MemoryResults = {
  [Op in keyof MemoryStore]: Awaited<ReturnType<MemoryStore[Op]>>
}

export type MemoryOp = MemoryRequest['op']

export type MemoryResponse =
  { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }

/** Said once, before anything is asked: the database is open and the file has been read. */
export type MemoryReady = ThreadReady

export function isMemoryReady(message: unknown): message is MemoryReady {
  return isRecord(message) && 'ready' in message
}
