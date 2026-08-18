import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './sourceFiles'
import { testFilesUnder } from './wideGuards'

/**
 * A JSDoc block that documents nothing, because another one follows it.
 *
 * TypeScript attaches the LAST block before a declaration and drops the rest, so two in a row
 * mean the first has lost whatever it was written for — and it reads as if it described the
 * declaration below, which is how a case ends up carrying another case's reason. Found eleven of
 * them on 2026-08-18, every one of them a paragraph somebody had written and nobody could see
 * was misplaced: a contract copied twice in `shared/ipc.ts`, a reason two cases below its own in
 * three suites, a renderer paragraph left behind by a method inserted above it.
 *
 * **Blind to blocks in column 0, and that is a bound rather than an oversight**: a file header
 * sitting above the first symbol's own block is the same shape and perfectly legitimate. The
 * distinction takes a parser, and a regex would either miss the defect or refuse the header.
 * **Twenty-four unindented ones were measured the same day**, `main/scenario/client.ts` and
 * `main/services.ts` among them, and they are a backlog entry rather than a silence here.
 */
const RULE = 'a JSDoc block followed by another documents nothing'

/** Every file a reader opens: sources on one side, suites on the other — `sourceFiles` drops those. */
const filesOfTree = (tree: string): string[] => [...sourceFiles(tree), ...testFilesUnder(tree)]

/**
 * Where an indented block is immediately followed by another, by line.
 *
 * Blank lines between the two count as adjacency: what matters is that no declaration sits
 * between them, and a blank line is not one.
 */
function orphansIn(code: string): number[] {
  const lines = code.split('\n')
  const found: number[] = []
  let closedAt = -1

  for (const [index, raw] of lines.entries()) {
    const text = raw.trim()
    if (text === '*/') {
      closedAt = index
      continue
    }
    if (text === '') continue
    if (text.startsWith('/**')) {
      const indented = raw.length > raw.trimStart().length
      if (closedAt >= 0 && indented) found.push(index + 1)
      // A one-line block opens and closes here: the next one after it is just as orphaned.
      closedAt = text.endsWith('*/') ? index : -1
      continue
    }
    closedAt = -1
  }

  return found
}

const findingsOf = (): string[] =>
  PROJECT_TREES.flatMap(tree => filesOfTree(tree)).flatMap(path =>
    orphansIn(readFileSync(path, 'utf8')).map(line => `${relative(SOURCE_ROOT, path)}:${line}`),
  )

describe(RULE, () => {
  it(
    'is followed by every source and every suite of the four trees',
    { timeout: WHOLE_PROJECT },
    () => {
      expect(findingsOf()).toEqual([])
    },
  )

  /**
   * The rule put in default, so the green above is one somebody has seen go red. Two blocks with
   * a blank line between them, which is the shape the eleven findings of 2026-08-18 had.
   */
  it('names the block that lost its declaration, and only that one', () => {
    const code = [
      'type A = {',
      '  /** first */',
      '',
      '  /** second */',
      '  member: string',
      '}',
    ].join('\n')

    expect(orphansIn(code)).toEqual([4])
  })

  /** A header above the first symbol's own block is the legitimate twin, and stays out. */
  it('leaves a file header followed by the first symbol alone', () => {
    const code = ['/** the module */', '/** the symbol */', 'export const value = 1'].join('\n')

    expect(orphansIn(code)).toEqual([])
  })
})
