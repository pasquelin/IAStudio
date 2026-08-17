import { describe, expect, it } from 'vitest'
import {
  defaultIgnore,
  filesInStage,
  hasChanges,
  hasStagedFiles,
  pathsOf,
  type GitFile,
} from './git'

const file = (path: string, stage: GitFile['stage'], change: GitFile['change']): GitFile => ({
  path,
  stage,
  change,
})

describe('the files of one stage', () => {
  it('keeps only that stage', () => {
    const files = [
      file('documents/board.scimg', 'staged', 'modified'),
      file('Images/hero.png', 'untracked', 'untracked'),
      file('.project.json', 'unstaged', 'modified'),
    ]

    expect(filesInStage(files, 'staged').map(entry => entry.path)).toEqual([
      'documents/board.scimg',
    ])
  })

  /**
   * Porcelain walks the index and the worktree separately, so the same two files can come back in
   * either order between two refreshes. A tree that reshuffles under the refresh button is a tree
   * whose rows cannot be clicked.
   */
  it('orders by path, whatever order git answered in', () => {
    const answered = [
      file('Videos/take-02.mp4', 'unstaged', 'modified'),
      file('.project.json', 'unstaged', 'modified'),
      file('documents/board.scimg', 'unstaged', 'deleted'),
    ]

    expect(filesInStage(answered, 'unstaged').map(entry => entry.path)).toEqual([
      '.project.json',
      'Videos/take-02.mp4',
      'documents/board.scimg',
    ])
  })
})

describe('whether a commit would record anything', () => {
  it('is false when everything is still in the worktree', () => {
    expect(hasStagedFiles([file('Images/hero.png', 'unstaged', 'modified')])).toBe(false)
  })

  it('is true once something is staged', () => {
    expect(hasStagedFiles([file('Images/hero.png', 'staged', 'added')])).toBe(true)
  })
})

describe('the paths a gesture applies to', () => {
  /**
   * A file edited, staged, then edited again appears in BOTH halves of porcelain. Passing the
   * path twice to `git add` fails with a lock error that reads like a defect in the studio.
   */
  it('names a file once even when it sits in both halves', () => {
    const both = [
      file('documents/board.scimg', 'staged', 'modified'),
      file('documents/board.scimg', 'unstaged', 'modified'),
    ]

    expect(pathsOf(both)).toEqual(['documents/board.scimg'])
  })
})

describe('a repository with nothing waiting', () => {
  it('says so, which is what stands the empty state up', () => {
    const status = { branch: 'main', head: 'a3f9c1e', upstream: null, ahead: 0, behind: 0 }

    expect(hasChanges({ ...status, files: [] })).toBe(false)
    expect(hasChanges({ ...status, files: [file('a.png', 'untracked', 'untracked')] })).toBe(true)
  })
})

describe('the ignore file written at init', () => {
  it('excludes the catalogue, which git would conflict on daily', () => {
    expect(defaultIgnore()).toContain('.index/')
  })

  /**
   * The one file holding which prompt, model and seed made each asset. A rescan rebuilds the
   * catalogue from the files; nothing rebuilds this. Ignoring it would let a project come home
   * from a clone with its pictures and none of their history.
   */
  it('leaves the provenance backup versioned', () => {
    expect(defaultIgnore()).not.toContain('.scenario')
  })
})
