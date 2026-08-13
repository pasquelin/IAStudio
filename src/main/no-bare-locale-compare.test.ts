import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const MAIN = dirname(fileURLToPath(import.meta.url))

/** Long enough for four trees of sources, like the sweeps in `no-hardcoded-text.test.ts`. */
const WHOLE_PROJECT = 60_000

/** Test material is out, on the line the rest of the project's guards already draw. */
function sourceFiles(directory: string, into: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) sourceFiles(path, into)
    else if (/\.tsx?$/.test(path) && !/(\.(test|bench)|-fixtures)\.tsx?$/.test(path))
      into.push(path)
  }

  return into
}

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

/** Every `localeCompare` called without being told which language to answer in. */
function bareCallsIn(path: string, source: string): string[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'localeCompare' &&
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
 * TWO blind spots, written down rather than left to be discovered:
 *
 * - **test material is not read**, on the line every other guard here draws. `bundles.test.ts`
 *   sorts its keys bare, and that is fine — a test's ordering reaches no reader.
 * - **`localeCompare(other, language)` is not measured for cost**, only for having a language at
 *   all. It builds a collator per comparison, which a sort pays n·log n times: 0.12 ms over 200
 *   names against a held `Intl.Collator`, measured the same day. Too small to buy an abstraction
 *   at the sizes the studio sorts, and the figure is here so the next reader can re-decide rather
 *   than re-measure.
 */
describe('no sort hands its language to the machine', () => {
  const trees = ['renderer', 'shared', 'preload'].map(tree => join(MAIN, '..', tree))

  const findingsOf = (): string[] =>
    [MAIN, ...trees].flatMap(tree =>
      sourceFiles(tree).flatMap(path =>
        bareCallsIn(relative(join(MAIN, '..'), path), readFileSync(path, 'utf8')),
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
    const counts = [MAIN, ...trees].map(tree => sourceFiles(tree).length)

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
    expect(bareCallsIn('probe.ts', 'const n = a.localeCompare(b, i18next.language)')).toEqual([])
  })

  // A guard that reads its own prose is a guard that fails on a sentence about it.
  it('reads neither a mention of the method nor a string that spells it', () => {
    expect(
      bareCallsIn('probe.ts', '/** `localeCompare(other)` answers in the OS locale. */'),
    ).toEqual([])
    expect(bareCallsIn('probe.ts', "const name = 'localeCompare'")).toEqual([])
  })
})
