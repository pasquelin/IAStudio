import { describe, expect, it } from 'vitest'
import { commandIn, scopeOfWorkspace } from '@shared/domain/command'
import type { WorkspaceId } from '@shared/domain/workspace'
import { WRITTEN_SOURCES } from '@/design/testHarness'

/**
 * The half of the `SCOPE_BY_WORKSPACE` trap that `shared/` cannot see.
 *
 * A store built on `createDocumentStore` records an undo history from its first `runCommand`.
 * If the workspace it serves names no scope, the native `role: 'undo'` keeps ⌘Z, the window
 * never sees the key, and no menu row can name a command — the history fills up and nothing
 * can pop it. Silent, and it has happened three times: Skyboxes, the take editor, and Materials,
 * whose manual promised ⌘Z on an applied style for as long as nothing answered.
 *
 * `command.test.ts` holds the other half — a scope named in the table declares both commands —
 * but no test there can reach this one: which stores hold a history is a fact of `renderer/`.
 */
const HISTORY_STORES: Readonly<Record<string, WorkspaceId>> = {
  'audioEdits.ts': 'audio',
  'canvases.ts': 'image',
  'scenes.ts': '3d',
  'sequences.ts': 'video',
  'skyboxes.ts': 'skyboxes',
  'materials.ts': 'materials',
}

/**
 * Read off the tree rather than listed by hand, so the table above cannot fall behind it.
 *
 * `documentStore.ts` declares the factory rather than calling it, and the bench builds one for
 * a fake state: neither edits a document, so neither serves a workspace.
 */
const FACTORY_ITSELF = 'documentStore'

const storesWithHistory = (): string[] =>
  WRITTEN_SOURCES.filter(
    ([path, source]) =>
      path.startsWith('../stores/') &&
      !path.includes(FACTORY_ITSELF) &&
      source.includes('createDocumentStore<'),
  ).map(([path]) => path.split('/').pop() ?? '')

describe('every store that records a history', () => {
  /** A store added without an entry below leaves this file describing a tree it no longer reads. */
  it('is named in the table this file checks', () => {
    expect(storesWithHistory().sort()).toEqual(Object.keys(HISTORY_STORES).sort())
  })

  /**
   * The guard proper. It would have failed on `textures.ts` the day it was written: the store
   * has held a history since § 8.3, and its workspace named no scope until the toolbars were
   * asked to stop drawing their own undo.
   */
  it('serves a workspace whose scope declares undo and redo', () => {
    const unreachable = Object.entries(HISTORY_STORES).filter(([, workspace]) => {
      const scope = scopeOfWorkspace(workspace)
      return !scope || !commandIn(scope, 'undo') || !commandIn(scope, 'redo')
    })

    expect(unreachable.map(([store]) => store)).toEqual([])
  })
})
