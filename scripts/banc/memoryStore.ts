import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Memory, MemoryScope } from '@shared/domain/assistantMemory'
import { MEMORY_FILE } from '@shared/domain/project'
import { openMemoryDatabase } from '@main/project/sqliteMemory'
import { createMemoryIndex } from '@main/memory/memoryIndex'
import { createMemoryStore, type MemoryStore } from '@main/memory/memoryStore'
import type { StudioBridge } from '@shared/ipc'

/**
 * 🛑 A PORT — the file and the database a memory lives in — and the REAL store over it, never a
 * second implementation. What a memory MEANS, what supersedes what, comes from `@main/memory`
 * exactly as the studio runs it; only the disk is temporary and only the database is in memory.
 */
export type BenchMemory = {
  channels: Partial<StudioBridge['memory']>
  /** What the project's memory holds right now, read synchronously — oracles are synchronous. */
  held: () => readonly Memory[]
  close: () => void
}

export function createBenchMemory(): BenchMemory {
  const root = mkdtempSync(join(tmpdir(), 'banc-memory-'))
  const database = openMemoryDatabase()
  const index = createMemoryIndex(database)
  let minted = 0
  const store: MemoryStore = createMemoryStore({
    file: join(root, MEMORY_FILE),
    index,
    now: () => new Date(2026, 7, 28, 0, 0, minted).toISOString(),
    newId: () => `m_${++minted}_${randomUUID().slice(0, 4)}`,
  })

  // The project's memory alone: no scenario writes into the machine's own, and a bench that
  // could would be measuring a gesture only the person may make.
  const project = <T>(scope: MemoryScope, answer: () => Promise<T>, none: T): Promise<T> =>
    scope === 'project' ? answer() : Promise.resolve(none)

  return {
    held: () => index.list({ limit: 100 }),
    close: () => {
      database.close()
      try {
        rmSync(root, { recursive: true, force: true })
      } catch {
        // 🛑 `Studio.close` is synchronous by design, so an append the store still had queued may
        // land between the walk and the unlink — ENOTEMPTY, measured. The folder is the OS's to
        // reap, and a scenario must not be failed by its own cleanup.
      }
    },
    channels: {
      list: (scope, query) => project(scope, () => store.list(query), []),
      /**
       * 🛑 No question EMBEDDED, and that is the port rather than the rule: the studio's embedder
       * is a model this bench has no reason to load, so a recall here ranks on words, anchors,
       * importance and recency — every voice of `recallScore` but the similar one.
       */
      recall: (scope, ask) =>
        project(
          scope,
          () =>
            store.recall({
              text: ask.text,
              refs: ask.refs ?? [],
              now: new Date(2026, 7, 28, 12).toISOString(),
              limit: ask.limit ?? 10,
            }),
          [],
        ),
      read: (scope, id) => project(scope, () => store.read(id), null),
      remember: (scope, draft) => project(scope, () => store.remember(draft), null),
      amend: (scope, id, patch) => project(scope, () => store.amend(id, patch), null),
      forget: (scope, id) => project(scope, () => store.forget(id), false),
      rebuild: scope => project(scope, () => store.rebuild(), 0),
      reset: scope => project(scope, () => store.reset(), undefined),
    },
  }
}
