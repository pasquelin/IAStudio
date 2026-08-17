import { describe, expect, it } from 'vitest'
import {
  canCommit,
  canRestore,
  defaultIgnore,
  filesInStage,
  hasChanges,
  hasStagedFiles,
  isBranchName,
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

describe('whether a version can be recorded', () => {
  it('wants both something ticked and something said', () => {
    const staged = [file('a.png', 'staged', 'added')]

    expect(canCommit(staged, '', false)).toBe(false)
    expect(canCommit([], 'un plan large', false)).toBe(false)
    expect(canCommit(staged, 'un plan large', false)).toBe(true)
  })

  /** A blank line is not a message, and git would take it — leaving a version nobody can read. */
  it('refuses a message made of nothing but space', () => {
    expect(canCommit([file('a.png', 'staged', 'added')], '   \n ', false)).toBe(false)
  })

  /**
   * Rewording the last message is the commonest reason to reach for an amend, and it stages
   * nothing. Refusing it would leave a typo permanent.
   */
  it('lets an amend through with nothing ticked', () => {
    expect(canCommit([], 'un plan large', true)).toBe(true)
  })
})

describe('whether a file can be put back', () => {
  it('offers it for the two changes that have an earlier version to go back to', () => {
    expect(canRestore(file('a.png', 'unstaged', 'modified'))).toBe(true)
    expect(canRestore(file('a.png', 'unstaged', 'deleted'))).toBe(true)
  })

  /**
   * A file git has never seen, and one being added for the first time, have no earlier version
   * anywhere: the only other reading of the gesture is a deletion, and that belongs to the
   * Explorer, where it goes through the system's wastebasket rather than vanishing.
   */
  it('withholds it where there is nothing earlier to restore', () => {
    expect(canRestore(file('a.png', 'untracked', 'untracked'))).toBe(false)
    expect(canRestore(file('a.png', 'staged', 'added'))).toBe(false)
  })
})

describe('a name git would take as a branch', () => {
  it('accepts the shapes people actually type', () => {
    expect(isBranchName('essai-lumiere')).toBe(true)
    expect(isBranchName('feat/panneau_git')).toBe(true)
  })

  it.each([
    ['', 'nothing at all'],
    ['  ', 'space alone'],
    ['essai lumiere', 'a space inside'],
    ['essai..lumiere', 'two dots'],
    ['~essai', 'a character git reserves'],
    ['/essai', 'a leading slash'],
    ['essai/', 'a trailing slash'],
    ['essai.lock', 'the suffix git keeps for itself'],
  ])('refuses %s — %s', name => {
    expect(isBranchName(name)).toBe(false)
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
