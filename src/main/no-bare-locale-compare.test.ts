import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sitesIn } from './ast-sites'
import { PROJECT_TREES, SOURCE_ROOT, sourceFiles, WHOLE_PROJECT } from './source-files'

/**
 * Whether the argument that would carry the decision says anything at all.
 *
 * `(other, undefined)` is spelled longer and means exactly `(other)`, so counting arguments is not
 * enough — the one in that position has to say something. Used for ALL THREE shapes the defect
 * takes: argument two of `localeCompare`, argument one of a collator, argument one of `sort`. The
 * first version of this file counted the collator's, which is the very mistake this paragraph
 * warns about, one function down; the batch's code review caught it. The `sort` rule was added
 * counting arguments too, and the batch's own review caught THAT — `[…].sort(undefined)` sorts by
 * code unit exactly as `[…].sort()` does, measured.
 */
function saysNothing(argument: ts.Expression | undefined): boolean {
  if (!argument) return true

  return ts.isIdentifier(argument) && argument.text === 'undefined'
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

  // A backtick is a third node kind for the same string, so half-closing the evasion is not
  // closing it. The review found this one too.
  if (
    ts.isElementAccessExpression(target) &&
    (ts.isStringLiteral(target.argumentExpression) ||
      ts.isNoSubstitutionTemplateLiteral(target.argumentExpression))
  )
    return target.argumentExpression.text

  return null
}

/**
 * A collator built with no locale, which is the same defect wearing the other constructor.
 *
 * `Intl.Collator().compare` answers in the OS locale exactly as a bare `localeCompare` does —
 * measured, `en-US`. `no-uncached-formatter.test.ts` bans a loose `new Intl` in the renderer, but
 * it says nothing about the argument and nothing about the other three trees.
 *
 * **With and without `new`**: `Intl.Collator(…)` called plainly is legal and returns a collator, so
 * a rule that only reads the `new` misses a working spelling. Both were pointed out by the review.
 */
function isIntlCollator(node: ts.Node): node is ts.NewExpression | ts.CallExpression {
  if (!ts.isNewExpression(node) && !ts.isCallExpression(node)) return false

  const target = node.expression
  return (
    ts.isPropertyAccessExpression(target) &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === 'Intl' &&
    target.name.text === 'Collator'
  )
}

const localelessCollatorsIn = (file: ts.SourceFile, path: string): string[] =>
  sitesIn(file, path, node => isIntlCollator(node) && saysNothing(node.arguments?.[0]))

// `toSorted` is the same order under the spelling ES2023 encourages, and Electron 43 ships it.
const SORTING_METHODS = ['sort', 'toSorted']

/**
 * Every comparison of two strings that leaves the language to the machine.
 *
 * Three rules over one file rather than three files: a held `Intl.Collator`, a bare
 * `localeCompare` and a `.sort()` handed no comparator are one defect written three ways, and a
 * guard catching one of them reads as covering all. The three share one parse — the sweep below
 * reads every file of four trees, and parsing is the whole cost of it.
 *
 * The bare `.sort()` is the spelling that says nothing at all: a reader cannot tell whether the
 * author meant a machine order or forgot the reader's language. `byCodeUnit` (`shared/text.ts`)
 * costs one import and answers that at the site, which is why this rule needs no exemption list —
 * `shared/hash.ts` was the last bare sort of `src/`, and naming its comparator changed no byte.
 *
 * Two edges of the `sort` rule, both found by the batch's adversarial review and neither closed
 * because nothing in `src/` writes them: `Array.prototype.sort.call(list)` names no method on the
 * list, and a home-made `sort()` on something that is not an array would be reported — the rule
 * reads the name, never the receiver's type.
 */
function bareCallsIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)

  return [
    ...localelessCollatorsIn(file, path),
    ...sitesIn(
      file,
      path,
      node =>
        ts.isCallExpression(node) &&
        calledName(node) === 'localeCompare' &&
        saysNothing(node.arguments[1]),
    ),
    ...sitesIn(
      file,
      path,
      node =>
        ts.isCallExpression(node) &&
        SORTING_METHODS.includes(calledName(node) ?? '') &&
        saysNothing(node.arguments[0]),
    ),
  ]
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
 * - **an order written in SQL passes in silence, and the reach is partial.** SQLite answers
 *   `ORDER BY <text>` in BINARY collation, over UTF-8 bytes. The batch that closed the two sites
 *   this paragraph used to name — the asset tags of `main/project/catalog.ts`, ordered one way by
 *   `ORDER BY tag` and another by a bare `.sort()`, measured to disagree above the BMP — left
 *   every remaining `ORDER BY` of `src/` on a timestamp, an id or `output_index`. A new one over
 *   text would not redden. Most are literals under a `prepare(`, which this sweep could read; the
 *   one that matters is not. `catalog.ts` builds `ORDER BY ${order}` from a value chosen a line
 *   earlier, so the only VARIABLE ordering of the repository is exactly the site an AST rule
 *   cannot decide — which is why this stays written down rather than half-closed.
 *
 *   That batch also caught this paragraph pricing the bare `.sort()` at "four wolves out of five",
 *   counting five in `src/`. The rule above replays that count now and finds none.
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
    'names a language or a comparator on every ordering in the project',
    () => {
      expect(findingsOf()).toEqual([])
    },
    WHOLE_PROJECT,
  )

  // That the four trees were actually opened is held by `source-files.test.ts`, on the walk both
  // guards borrow — an empty result here proves nothing unless the files were read.

  it('reads the sort that names nothing, and lets the one with a comparator through', () => {
    expect(bareCallsIn('probe.ts', 'const kept = names.sort()')).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', "const kept = names['sort']()")).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', 'const kept = names.sort(byCodeUnit)')).toEqual([])
    expect(
      bareCallsIn('probe.ts', "const kept = names.sort((a, b) => a.localeCompare(b, 'fr'))"),
    ).toEqual([])
  })

  /**
   * The two the review measured, and the reason the rule reads the argument rather than count it:
   * `[…].sort(undefined)` orders by code unit exactly as `[…].sort()` does, and `toSorted` is the
   * spelling ES2023 encourages for the same order. Counting arguments passed both.
   */
  it('reads the sort whose comparator is spelled undefined, and the copying spelling', () => {
    expect(bareCallsIn('probe.ts', 'const kept = names.sort(undefined)')).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', 'const kept = names.toSorted()')).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', 'const kept = names.toSorted(byCodeUnit)')).toEqual([])
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
  it('reads the call spelled through an element access, in both quotings', () => {
    expect(bareCallsIn('probe.ts', "const n = a['localeCompare'](b)")).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', 'const n = a[`localeCompare`](b)')).toEqual(['probe.ts:1'])
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

  /**
   * The two holes the review measured in the rule above, and they are the same mistake this file
   * warns about in prose: an argument spelled `undefined` says nothing, and `Intl.Collator(…)`
   * without `new` is a working spelling. Both resolve to the host locale — measured, `en-US`.
   */
  it('reads the collator whose locale is spelled undefined, and the one built without new', () => {
    expect(bareCallsIn('probe.ts', 'const c = new Intl.Collator(undefined)')).toEqual([
      'probe.ts:1',
    ])
    expect(
      bareCallsIn('probe.ts', "const c = new Intl.Collator(undefined, { sensitivity: 'base' })"),
    ).toEqual(['probe.ts:1'])
    expect(
      bareCallsIn('probe.ts', 'const c = Intl.Collator(undefined, { numeric: true })'),
    ).toEqual(['probe.ts:1'])
    expect(bareCallsIn('probe.ts', "const c = Intl.Collator('fr', { numeric: true })")).toEqual([])
  })

  // A guard that reads its own prose is a guard that fails on a sentence about it.
  it('reads neither a mention of the method nor a string that spells it', () => {
    expect(
      bareCallsIn('probe.ts', '/** `localeCompare(other)` answers in the OS locale. */'),
    ).toEqual([])
    expect(bareCallsIn('probe.ts', "const name = 'localeCompare'")).toEqual([])
  })
})
