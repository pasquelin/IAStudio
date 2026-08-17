import { describe, expect, it } from 'vitest'
import { diffTally, parseUnifiedDiff } from './gitDiff'

const DIFF = [
  'diff --git a/notes.txt b/notes.txt',
  'index 0f3a1c2..9b21d4e 100644',
  '--- a/notes.txt',
  '+++ b/notes.txt',
  '@@ -1,3 +1,4 @@ le plan',
  ' inchangé',
  '-parti',
  '+arrivé',
  '+arrivé aussi',
  ' encore inchangé',
].join('\n')

describe('what changed inside a text file', () => {
  it('reads each line into the side it belongs to', () => {
    const diff = parseUnifiedDiff(DIFF)
    if (diff.kind !== 'text') throw new Error('expected a text diff')

    expect(diff.hunks[0]?.lines.map(line => [line.side, line.text])).toEqual([
      ['context', 'inchangé'],
      ['removed', 'parti'],
      ['added', 'arrivé'],
      ['added', 'arrivé aussi'],
      ['context', 'encore inchangé'],
    ])
  })

  /**
   * The two columns of numbers are the whole point of a unified diff: a removed line has a number
   * on the left and none on the right, an added one the other way round.
   */
  it('numbers each side against its own version', () => {
    const diff = parseUnifiedDiff(DIFF)
    if (diff.kind !== 'text') throw new Error('expected a text diff')

    expect(diff.hunks[0]?.lines.map(line => [line.before, line.after])).toEqual([
      [1, 1],
      [2, null],
      [null, 2],
      [null, 3],
      [3, 4],
    ])
  })

  /** Everything before the first `@@` says which file and which blobs. None of it is content. */
  it('leaves out the header git writes about the file itself', () => {
    const diff = parseUnifiedDiff(DIFF)
    if (diff.kind !== 'text') throw new Error('expected a text diff')

    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]?.lines.map(line => line.text)).not.toContain('diff --git a/notes.txt')
  })

  /** A note ABOUT the line above it, not a line of the file — shown, it reads as a removal. */
  it('leaves out the no-newline note', () => {
    const diff = parseUnifiedDiff(
      ['@@ -1 +1 @@', '-un', '\\ No newline at end of file', '+deux'].join('\n'),
    )
    if (diff.kind !== 'text') throw new Error('expected a text diff')

    expect(diff.hunks[0]?.lines.map(line => line.text)).toEqual(['un', 'deux'])
  })
})

describe('a file git cannot line up', () => {
  /** Not a failure: it is the ordinary answer for most of a studio project, and what sends the
   * panel to draw the two versions as pictures instead. */
  it('says so rather than reading an empty diff', () => {
    expect(parseUnifiedDiff('Binary files a/hero.png and b/hero.png differ')).toEqual({
      kind: 'binary',
    })
  })

  it('says so for a patch git wrote in its own binary form', () => {
    expect(parseUnifiedDiff('GIT binary patch\ndelta 42\n').kind).toBe('binary')
  })
})

describe('a comparison with nothing in it', () => {
  it('is empty rather than a text diff of no hunks', () => {
    expect(parseUnifiedDiff('')).toEqual({ kind: 'empty' })
  })
})

describe('the tally a header shows', () => {
  it('counts each side', () => {
    expect(diffTally(parseUnifiedDiff(DIFF))).toEqual({ added: 2, removed: 1 })
  })

  it('counts nothing for a comparison that has no lines to count', () => {
    expect(diffTally({ kind: 'binary' })).toEqual({ added: 0, removed: 0 })
  })
})
