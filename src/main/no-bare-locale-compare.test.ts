import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { PROJECT_TREES, SOURCE_ROOT, sourceFiles, WHOLE_PROJECT } from './source-files'

/**
 * Whether a call names the language it answers in.
 *
 * `localeCompare(other, undefined)` is spelled longer and means exactly `localeCompare(other)`, so
 * counting arguments is not enough — the second one has to say something.
 */
function namesNoLanguage(call: ts.CallExpression): boolean {
  const language = call.arguments[1]
  if (!language) return true

  return ts.isIdentifier(language) && language.text === 'undefined'
}

/**
 * What a call is named, whether it is written `a.localeCompare(b)` or `a['localeCompare'](b)`.
 *
 * The second spelling is nobody's habit, which is exactly why a guard has to read it: a rule that
 * a rename tool or a minifier can slip past is a rule that stops holding without saying so.
 */
function calledName(call: ts.CallExpression): string | null {
  const target = call.expression
  if (ts.isPropertyAccessExpression(target)) return target.name.text
  if (ts.isElementAccessExpression(target) && ts.isStringLiteral(target.argumentExpression))
    return target.argumentExpression.text

  return null
}

/**
 * A collator built with no locale, which is the same defect wearing the other constructor.
 *
 * `new Intl.Collator().compare` answers in the OS locale exactly as a bare `localeCompare` does.
 * `no-uncached-formatter.test.ts` bans a loose `new Intl` in the renderer, but it says nothing
 * about the argument and nothing about the other three trees.
 */
function localelessCollatorsIn(file: ts.SourceFile, path: string): string[] {
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Intl' &&
      node.expression.name.text === 'Collator' &&
      (node.arguments?.length ?? 0) === 0
    ) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file))
      found.push(`${path}:${line + 1}`)
    }

    ts.forEachChild(node, walk)
  }

  walk(file)
  return found
}

/** Every comparison of two strings that leaves the language to the machine. */
function bareCallsIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const found: string[] = localelessCollatorsIn(file, path)

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      calledName(node) === 'localeCompare' &&
      namesNoLanguage(node)
    ) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file))
      found.push(`${path}:${line + 1}`)
    }

    ts.forEachChild(node, walk)
  }

  walk(file)
  return found
}

/**
 * A sort is a decision about a language, and a bare `localeCompare` hands it to the machine.
 *
 * Left without a language, it answers in the locale the OS was installed in — which is not one of
 * the two the studio speaks, and not the one the reader picked in the preferences. Measured on
 * 2026-08-13 over eighteen realistic names: `fr` and `en` agree on every pair, so the defect is
 * invisible from either of the studio's own languages; `sv` files `Ä` and `Å` past `Z`, and `tr`
 * splits the dotted and dotless `i`. A French project browsed on a Swedish desktop was ordered to
 * Swedish rules, and nothing in the repository could see it.
 *
 * Three sites were sorting names a person reads that way — the document titles, the folder
 * listing and the font picker — and four more were running ISO stamps and schema keys through an
 * ICU collator, which is `byCodeUnit` in `shared/text.ts` instead.
 *
 * THREE blind spots, written down rather than left to be discovered:
 *
 * - **test material is not read**, on the line every other guard here draws. `bundles.test.ts`
 *   sorts its keys bare, and that is fine — a test's ordering reaches no reader.
 * - **`localeCompare(other, language)` is not measured for cost**, only for having a language at
 *   all. It builds a collator per comparison, which a sort pays n·log n times: 0.12 ms over 200
 *   names against a held `Intl.Collator`, and under 0.1 ms at the 4000 rushes of `assets/vid`,
 *   the largest list the studio sorts. Too small to route a sort through `kept`, and the figures
 *   are here so the next reader can re-decide rather than re-measure.
 * - **this reads TWO spellings, and the class of defect has more.** Both found by the batch's own
 *   adversarial review, both in `main/project/catalog.ts`, both on the asset tags a person types
 *   and reads: `.sort()` with no comparator at line 518, and `ORDER BY tag` at line 461, which
 *   SQLite answers in BINARY collation. A French project tagged `Éclairage`, `Extérieur`, `Zoom`
 *   lists as `Extérieur, Zoom, Éclairage`. Neither is reachable from here — one is a call this
 *   rule does not name, the other is a string in a query — and **a rule banning the bare `.sort()`
 *   would cry wolf four times out of five**: counted, five live in `src/` and four order keys a
 *   machine reads, where determinism is the point. Those two sites are a batch of their own,
 *   because the catalogue is a SQL port that knows nothing but `@shared`, and whether it should
 *   order names at all is a question about layers rather than about a comparator.
 *
 * And one it CANNOT close, rather than a choice: this reads a file at a time, so it sees that a
 * language was named, never what that name holds at runtime. `localeCompare(other, language)`
 * passes here whatever `language` turns out to be — which is how `stores/documents.ts` handed it
 * `i18next.language`, `undefined` until `initI18n` resolves and `pseudo` under the DEV flag, both
 * of which `Intl` resolves to `en-US`. `resolveLanguage` (`shared/i18n`) is the way through, and
 * only a reader can tell that the expression goes through it.
 */
describe('no sort hands its language to the machine', () => {
  const findingsOf = (): string[] =>
    PROJECT_TREES.flatMap(tree =>
      sourceFiles(tree).flatMap(path =>
        bareCallsIn(relative(SOURCE_ROOT, path), readFileSync(path, 'utf8')),
      ),
    )

  it(
    'calls localeCompare with a language everywhere in the project',
    () => {
      expect(findingsOf()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  // An empty result proves nothing unless the files were opened: pointed at a folder that does
  // not exist, the assertion above stays green. The four trees are counted, not assumed.
  it('holds all four trees, modules and components alike', () => {
    const counts = PROJECT_TREES.map(tree => sourceFiles(tree).length)

    expect(counts).toHaveLength(4)
    expect(counts.every(count => count > 0)).toBe(true)
    expect(counts.reduce((total, count) => total + count, 0)).toBeGreaterThan(700)
  })

  it('sees the bare call, and the one that spells the absence out', () => {
    expect(bareCallsIn('probe.ts', 'const n = a.localeCompare(b)')).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', 'const n = a.localeCompare(b, undefined)')).toEqual([
      'probe.ts:1',
    ])
  })

  it('leaves the call that names a language alone', () => {
    expect(bareCallsIn('probe.ts', "const n = a.localeCompare(b, 'fr')")).toEqual([])
    expect(bareCallsIn('probe.ts', 'const n = a.localeCompare(b, language)')).toEqual([])
  })

  // Nobody writes it this way, which is the reason a guard has to: a rule a rename tool can slip
  // past is a rule that stops holding without saying so. Found by the batch's own review.
  it('reads the call spelled through an element access', () => {
    expect(bareCallsIn('probe.ts', "const n = a['localeCompare'](b)")).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', "const n = a['localeCompare'](b, 'fr')")).toEqual([])
  })

  /**
   * The same defect wearing the other constructor, and the second evasion the review measured.
   * `new Intl.Collator()` with no locale answers in the OS locale exactly as the bare call does —
   * `en-US`, measured. A collator handed a language is the cheaper form and stays welcome.
   */
  it('reads a collator built with no locale, and lets the one with a language through', () => {
    expect(bareCallsIn('probe.ts', 'const c = new Intl.Collator()')).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', "const c = new Intl.Collator('fr')")).toEqual([])
    expect(bareCallsIn('probe.ts', 'const c = new Intl.NumberFormat()')).toEqual([])
  })

  // A guard that reads its own prose is a guard that fails on a sentence about it.
  it('reads neither a mention of the method nor a string that spells it', () => {
    expect(
      bareCallsIn('probe.ts', '/** `localeCompare(other)` answers in the OS locale. */'),
    ).toEqual([])
    expect(bareCallsIn('probe.ts', "const name = 'localeCompare'")).toEqual([])
  })
})
