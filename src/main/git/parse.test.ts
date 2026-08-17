import { describe, expect, it } from 'vitest'
import { failureOf, filesOf, safeMessage, type PorcelainEntry } from './parse'

const row = (path: string, index: string, working_dir: string): PorcelainEntry => ({
  path,
  index,
  working_dir,
})

describe('porcelain rows turned into files', () => {
  it('reads the index letter as staged and the worktree letter as not', () => {
    expect(
      filesOf([row('documents/board.scimg', 'A', ' '), row('.project.json', ' ', 'M')]),
    ).toEqual([
      { path: 'documents/board.scimg', stage: 'staged', change: 'added' },
      { path: '.project.json', stage: 'unstaged', change: 'modified' },
    ])
  })

  /**
   * The whole reason a path may appear twice. `MM` is a file that was modified, staged, then
   * modified again — showing it once would let a commit record a version nobody is looking at.
   */
  it('splits a file touched on both sides into two rows', () => {
    expect(filesOf([row('Images/hero.png', 'M', 'M')])).toEqual([
      { path: 'Images/hero.png', stage: 'staged', change: 'modified' },
      { path: 'Images/hero.png', stage: 'unstaged', change: 'modified' },
    ])
  })

  it('reads a file git has never seen as untracked, not as added twice', () => {
    expect(filesOf([row('Videos/take-02.mp4', '?', '?')])).toEqual([
      { path: 'Videos/take-02.mp4', stage: 'untracked', change: 'untracked' },
    ])
  })

  /**
   * `AA` is "both sides added this", not "added twice". Reading the letters apart would file a
   * conflict under `staged` and let the panel offer a commit that git refuses.
   */
  it('reads a both-sides code as one conflict', () => {
    expect(filesOf([row('documents/scene.sc3d', 'A', 'A')])).toEqual([
      { path: 'documents/scene.sc3d', stage: 'conflicted', change: 'conflicted' },
    ])
  })

  it('carries where a rename came from', () => {
    expect(
      filesOf([{ ...row('Images/hero-final.png', 'R', ' '), from: 'Images/hero.png' }]),
    ).toEqual([
      {
        path: 'Images/hero-final.png',
        stage: 'staged',
        change: 'renamed',
        from: 'Images/hero.png',
      },
    ])
  })
})

describe('why a command did not answer', () => {
  it.each([
    ['fatal: not a git repository (or any of the parent directories)', 'not-a-repository'],
    ['fatal: Unable to create /p/.git/index.lock: File exists.', 'locked'],
    ['spawn git ENOENT', 'binary-missing'],
    ['fatal: Authentication failed for https://github.com/a/b.git', 'authentication'],
    ['fatal: unable to access https://github.com: Could not resolve host: github.com', 'network'],
    ['CONFLICT (content): Merge conflict in documents/board.scimg', 'conflict'],
  ])('reads %s', (message, reason) => {
    expect(failureOf(new Error(message))).toBe(reason)
  })

  /** Anything unrecognised stays unrecognised: a guessed sentence is worse than git's own. */
  it('does not guess at a message it has no pattern for', () => {
    expect(failureOf(new Error('fatal: something nobody has seen'))).toBe('unknown')
  })
})

describe('the line shown and written down', () => {
  /**
   * Git echoes the remote on failure, and a remote carrying a token would put that token in a
   * log file the studio keeps and the user may well send on.
   */
  it('takes the credentials out of a remote git echoed back', () => {
    const echoed = new Error(
      'fatal: unable to access https://x-access-token:ghp_secret@github.com/a/b.git/',
    )

    expect(safeMessage(echoed)).not.toContain('ghp_secret')
    expect(safeMessage(echoed)).toContain('github.com/a/b.git')
  })

  it('leaves a message carrying no credential alone', () => {
    expect(safeMessage(new Error('fatal: not a git repository'))).toBe(
      'fatal: not a git repository',
    )
  })
})
