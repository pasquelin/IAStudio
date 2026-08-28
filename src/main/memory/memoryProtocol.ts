import type {
  Memory,
  MemoryDraft,
  MemoryPatch,
  MemoryQuery,
  MemoryTrouble,
} from '@shared/domain/assistantMemory'
import type { RecallAsk } from './memoryIndex'
import type { MemoryVector, PendingVector } from './vectors'

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
  | { id: number; op: 'markUsed'; ids: readonly string[] }
  | { id: number; op: 'rebuild' }
  | { id: number; op: 'refresh' }
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
  remember: Memory
  amend: Memory | null
  forget: boolean
  read: Memory | null
  list: readonly Memory[]
  markUsed: void
  rebuild: number
  refresh: number
  reset: void
  trouble: MemoryTrouble | null
  recall: readonly Memory[]
  writeVectors: void
  withoutVector: readonly PendingVector[]
  pendingVectors: number
  dropOtherVectors: void
  close: void
}

export type MemoryOp = MemoryRequest['op']

export type MemoryResponse =
  { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }

/** Said once, before anything is asked: the database is open and the file has been read. */
export type MemoryReady = { ready: true } | { ready: false; error: string }

export function isMemoryReady(message: unknown): message is MemoryReady {
  return typeof message === 'object' && message !== null && 'ready' in message
}
