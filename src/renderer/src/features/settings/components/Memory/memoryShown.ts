import { MEMORY_STATES, type MemoryState } from '@shared/domain/assistantMemory'

/** What this section shows: archived rows too — the point of archiving is that it stays read. */
export const MEMORY_SHOWN: readonly MemoryState[] = MEMORY_STATES.filter(one => one !== 'dropped')
