import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { walkIn } from './astSites'
import { PROJECT_TREES, SOURCE_ROOT, WHOLE_PROJECT, sourceFiles } from './sourceFiles'
import { testFilesUnder } from './wideGuards'

/**
 * A JSDoc block that documents nothing, because another one follows it.
 *
 * TypeScript attaches the LAST block before a declaration and drops the rest, so two in a row
 * mean the first has lost whatever it was written for — and it reads as if it described the
 * declaration below, which is how a case ends up carrying another case's reason. Forty were
 * found on 2026-08-18 across two batches, one of them a contract copied twice in `shared/ipc.ts`
 * and one a pair of sentences that CONTRADICTED each other on `Tree.tsx`'s `onContextMenu`.
 *
 * **One header per file is tolerated, and only on the first declaration that carries any doc,
 * and only in column 0**: a module header above the first symbol's own block is the same shape
 * as the defect, and an indented block is never one. That tolerance is what a line-based sweep
 * could not express — it read 24 sites where an independent recount read 23 and a third pass
 * read 77, three numbers for one tree, which is why this reads the parser instead.
 */
const RULE = 'a JSDoc block followed by another documents nothing'

/** Every file a reader opens: sources on one side, suites on the other — `sourceFiles` drops those. */
const filesOfTree = (tree: string): string[] => [...sourceFiles(tree), ...testFilesUnder(tree)]

/** The `/** …` ranges TypeScript would consider for `start`, in source order. */
const docsBefore = (text: string, start: number): readonly ts.CommentRange[] =>
  (ts.getLeadingCommentRanges(text, start) ?? []).filter(
    range => text.slice(range.pos, range.pos + 3) === '/**',
  )

function orphansIn(path: string, text: string): string[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
  const visited = new Set<number>()
  const found: string[] = []
  let headerSpent = false

  walkIn(file, node => {
    // Nested nodes share the leading trivia of their parent, so a block would be reported once
    // per level without this.
    if (visited.has(node.getFullStart())) return
    visited.add(node.getFullStart())

    const docs = docsBefore(text, node.getFullStart())
    if (docs.length === 0) return

    // A module header opens in column 0 — an indented block never is one, whatever it sits above.
    // The header is the FIRST block, so it is dropped from the front rather than counted off the
    // end: counting made three stacked blocks report the header and spare the orphan between them.
    const opensTheFile =
      !headerSpent && file.getLineAndCharacterOfPosition(docs[0]?.pos ?? 0).character === 0
    headerSpent = true
    for (const range of docs.slice(opensTheFile ? 1 : 0, -1))
      found.push(`${path}:${file.getLineAndCharacterOfPosition(range.pos).line + 1}`)
  })

  return found
}

const findingsOf = (): string[] =>
  PROJECT_TREES.flatMap(tree => filesOfTree(tree)).flatMap(path =>
    orphansIn(relative(SOURCE_ROOT, path), readFileSync(path, 'utf8')),
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
   * The rule put in default, so the green above is one somebody has seen go red.
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

    expect(orphansIn('probe.ts', code)).toEqual(['probe.ts:2'])
  })

  /** The legitimate twin, and the one a line-based sweep could not tell from the defect. */
  it('leaves a module header above the first documented symbol alone', () => {
    const code = ['/** the module */', '/** the symbol */', 'export const value = 1'].join('\n')

    expect(orphansIn('probe.ts', code)).toEqual([])
  })

  /**
   * The tolerance spares the HEADER, not "one of them": found by review, and it was an inversion
   * rather than a miscount — three stacked blocks used to report the header and spare the orphan.
   */
  it('spares the header and names what stands between it and the real block', () => {
    const code = [
      '/** the module */',
      '/** stranded */',
      '/** the symbol */',
      'export const value = 1',
    ].join('\n')

    expect(orphansIn('probe.ts', code)).toEqual(['probe.ts:2'])
  })

  /** The tolerance is spent once: a file does not open twice, whatever its length. */
  it('takes the header only for the first documented symbol', () => {
    const code = [
      '/** the module */',
      '/** the first symbol */',
      'export const first = 1',
      '',
      '/** stranded */',
      '/** the second symbol */',
      'export const second = 2',
    ].join('\n')

    expect(orphansIn('probe.ts', code)).toEqual(['probe.ts:5'])
  })
})
