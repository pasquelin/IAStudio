import { describe, expect, it } from 'vitest'
import { parentOf } from '@shared/domain/folder'
import { STARTER_FOLDERS } from '@shared/domain/project'
import { PROJECT } from './project'

/**
 * 🛑 The tree the bench lays down drifted from the one `create` lays down, twice — `Videos` and
 * `Skyboxes` named no constant at all, and `Animations` was missing. Nothing rougissait: a bench
 * on a tree the studio never makes still runs, and scores gestures against a project nobody has.
 */
describe('the project the bench lays down', () => {
  it('holds every folder a real project is given', () => {
    const laid = PROJECT.filter(entry => entry.kind === 'folder').map(entry => entry.path)
    expect([...laid].sort()).toEqual([...STARTER_FOLDERS].sort())
  })

  it('seeds no file into a folder the project does not have', () => {
    const folders = new Set(PROJECT.filter(entry => entry.kind === 'folder').map(one => one.path))
    const stray = PROJECT.filter(
      entry => entry.kind === 'file' && !folders.has(parentOf(entry.path) ?? ''),
    ).map(entry => entry.path)

    expect(stray).toEqual([])
  })
})
