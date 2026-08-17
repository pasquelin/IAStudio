import { describe, expect, it } from 'vitest'
import {
  failureOf,
  filesOf,
  parseLog,
  parseNameStatus,
  parseRefs,
  parseStashList,
  safeMessage,
  type PorcelainEntry,
} from './parse'

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

/** The same two separators the format string asks git for. Built, never typed: both are invisible. */
const FIELD = String.fromCharCode(31)
const RECORD = String.fromCharCode(30)

const logLine = (...fields: string[]): string => fields.join(FIELD) + RECORD

describe('the log git wrote', () => {
  it('reads a commit into each of its fields', () => {
    const output = logLine(
      'a3f9',
      'b1c2',
      'Alban',
      '2026-08-17T10:42:00+02:00',
      'HEAD -> main, tag: v1.0',
      'Ajout du plan large',
    )

    expect(parseLog(output)).toEqual([
      {
        hash: 'a3f9',
        parents: ['b1c2'],
        author: 'Alban',
        at: '2026-08-17T10:42:00+02:00',
        refs: [
          { kind: 'branch', name: 'main' },
          { kind: 'tag', name: 'v1.0' },
        ],
        message: 'Ajout du plan large',
      },
    ])
  })

  it('reads the two parents of a merge', () => {
    const output = logLine('m1', 'c1 b1', 'Alban', '2026-08-17T10:00:00Z', '', 'Fusion')

    expect(parseLog(output)[0]?.parents).toEqual(['c1', 'b1'])
  })

  /** The very first commit writes an empty field, which splits into one empty string. */
  it('gives the first commit no parent rather than an empty one', () => {
    const output = logLine('a1', '', 'Alban', '2026-08-17T09:00:00Z', '', 'Version initiale')

    expect(parseLog(output)[0]?.parents).toEqual([])
  })

  /**
   * The whole reason the separators are what they are. A message holding a tab, a newline or a
   * pipe would break any format a person could type, and a message is written by a person.
   */
  it('survives a message holding whatever somebody pasted into it', () => {
    const output = logLine('a1', '', 'Alban', '2026-08-17T09:00:00Z', '', 'Fix\ttab | pipe — dash')

    expect(parseLog(output)[0]?.message).toBe('Fix\ttab | pipe — dash')
  })

  it('reads nothing out of an empty log', () => {
    expect(parseLog('')).toEqual([])
  })
})

describe('the names pointing at a commit', () => {
  it('tells a tag from a branch from a branch on the server', () => {
    expect(parseRefs('HEAD -> main, tag: v1.0, origin/main')).toEqual([
      { kind: 'branch', name: 'main' },
      { kind: 'tag', name: 'v1.0' },
      { kind: 'remote', name: 'origin/main' },
    ])
  })

  /** Which branch is out is already said by the branch button, and would be the only row with it. */
  it('drops the arrow, keeping the branch it points at', () => {
    expect(parseRefs('HEAD -> essai-lumiere')).toEqual([{ kind: 'branch', name: 'essai-lumiere' }])
  })

  /** A detached head names nothing a reader could go to. */
  it('drops a bare HEAD', () => {
    expect(parseRefs('HEAD')).toEqual([])
  })

  it('reads nothing off a commit nothing points at', () => {
    expect(parseRefs('')).toEqual([])
  })
})

describe('what one recorded version changed', () => {
  it('reads a letter and a path per line', () => {
    expect(parseNameStatus('M\tdocuments/board.scimg\nA\tImages/hero.png\n')).toEqual([
      { path: 'documents/board.scimg', change: 'modified' },
      { path: 'Images/hero.png', change: 'added' },
    ])
  })

  /**
   * A rename writes its similarity score into the letter's own field, and both paths after it.
   * The row is named for where the file is NOW, which is the second one.
   */
  it('names a rename for where the file ended up, and remembers where it was', () => {
    expect(parseNameStatus('R096\tImages/hero.png\tImages/hero-final.png')).toEqual([
      { path: 'Images/hero-final.png', change: 'renamed', from: 'Images/hero.png' },
    ])
  })

  it('reads nothing out of a commit that touched no file', () => {
    expect(parseNameStatus('\n\n')).toEqual([])
  })
})

describe('the piles set aside', () => {
  /** The place in the stack is the LINE, not something git writes: `stash@{0}` is the newest. */
  it('numbers each pile by its place, newest first', () => {
    expect(parseStashList('Travail sur main\nEssai de lumière\n')).toEqual([
      { index: 0, message: 'Travail sur main' },
      { index: 1, message: 'Essai de lumière' },
    ])
  })

  it('reads nothing off an empty stack', () => {
    expect(parseStashList('')).toEqual([])
  })

  /**
   * A pile made outside the studio can carry no message at all, and the number is what `stash
   * pop` and `stash drop` are given. Counted after the blank lines were dropped, every pile
   * below such a one is off by one — and a drop then throws away a pile nobody asked about.
   */
  it('keeps the numbering git itself uses when a pile has nothing to say', () => {
    expect(parseStashList('Travail sur main\n\nEssai de lumière\n')).toEqual([
      { index: 0, message: 'Travail sur main' },
      { index: 2, message: 'Essai de lumière' },
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
