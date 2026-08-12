import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The whole window, as text — read through Vite like `no-hardcoded-text.test.ts` reads it: the
 * renderer has no filesystem, and a test living here does not get one.
 */
const SOURCES: Record<string, string> = import.meta.glob(
  ['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx', '!./**/*-fixtures.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * The three that build a formatter and throw it away.
 *
 * `toLocaleString` and its two siblings take a language and return a string, which reads as free.
 * It is not: each call constructs an `Intl` formatter — 48 µs against 4, the figure `helpers/
 * format.ts` was written around — and the studio drew six of them per render of the scene
 * counters, over a viewport being turned.
 */
const UNCACHED = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'])

function callsIn(source: string): string[] {
  const tree = ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true)
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      UNCACHED.has(node.expression.name.text)
    )
      found.push(node.expression.name.text)

    ts.forEachChild(node, walk)
  }

  walk(tree)
  return found
}

describe('the window formats through kept formatters', () => {
  /**
   * The rule the two call sites this guard was written for had each broken on their own, months
   * apart, while `ActivityList` spelled it out in a comment three files away. A comment is not a
   * guard: this reads the CALL, so the prose naming these methods stays legible.
   *
   * The fix is never to add a cache beside the call — `helpers/format.ts` already holds one per
   * shape and language. `formatDecimal`, `formatMoment`, `formatPercent`, `formatBytes` and
   * `formatList` are the ways through it.
   *
   * No file is exempt, the two formatter homes included: they build through `new Intl.X` under
   * `kept`, and neither calls one of these. An exemption for a rule nobody needs to break is a
   * door the next reader walks through.
   */
  it('builds no throwaway Intl formatter, anywhere in the window', () => {
    const offenders = Object.entries(SOURCES).flatMap(([path, source]) =>
      callsIn(source).map(method => `${path} calls ${method}`),
    )

    expect(offenders).toEqual([])
  })

  // A guard nobody can trip is a guard nobody keeps: this proves the walk sees a real call, and
  // that the prose in `ActivityList` and in `format.ts` does not trip it.
  it('reads the call and not the sentence that names it', () => {
    expect(callsIn('const s = value.toLocaleString(language)')).toEqual(['toLocaleString'])
    expect(callsIn('/** `toLocaleTimeString` builds a fresh one on every call. */')).toEqual([])
    expect(callsIn("const name = 'toLocaleString'")).toEqual([])
  })
})
