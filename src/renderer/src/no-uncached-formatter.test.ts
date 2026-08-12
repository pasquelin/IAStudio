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
 * The three that build a formatter without looking like it.
 *
 * `toLocaleString` and its two siblings take a language and return a string, which reads as free.
 * It is not: each call constructs an `Intl` formatter — 48 µs against 4, the figure `helpers/
 * format.ts` was written around — and the studio drew six of them per render of the scene
 * counters, over a viewport being turned.
 */
const UNCACHED = new Set(['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'])

/** The one function that holds a formatter past its call — `helpers/format.ts` exports it. */
const CACHE = 'kept'

function parse(source: string): ts.SourceFile {
  // `setParentNodes`, because the `new Intl` rule below is about a node's ANCESTRY, not its shape.
  return ts.createSourceFile('x.tsx', source, ts.ScriptTarget.Latest, true)
}

function heldByCache(node: ts.Node): boolean {
  for (let up = node.parent; up; up = up.parent)
    if (ts.isCallExpression(up) && ts.isIdentifier(up.expression) && up.expression.text === CACHE)
      return true

  return false
}

function buildsIn(source: string): string[] {
  const found: string[] = []

  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      UNCACHED.has(node.expression.name.text)
    )
      found.push(`calls ${node.expression.name.text}`)

    if (
      ts.isNewExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'Intl' &&
      !heldByCache(node)
    )
      found.push(`builds a loose Intl.${node.expression.name.text}`)

    ts.forEachChild(node, walk)
  }

  walk(parse(source))
  return found
}

describe('the window builds every Intl formatter inside the cache', () => {
  /**
   * The rule the two call sites this guard was written for had each broken on their own, months
   * apart, while `ActivityList` spelled it out in a comment three files away. A comment is not a
   * guard: this reads the CALL and the `new`, so the prose naming these methods stays legible.
   *
   * The fix is never a cache beside the call — `helpers/format.ts` holds one per shape and
   * language. `formatDecimal`, `formatMoment`, `formatPercent`, `formatBytes` and `formatList`
   * are the ways through it, and a shape none of them covers is built inside `kept` like the
   * nine already there.
   *
   * No file is exempt, and none needs to be: every `new Intl` in the window already sits inside
   * a `kept` call. Naming a file here would exempt everything it ever grows, which is how the
   * `toLocaleString` in the scene counters would have survived a narrower rule.
   */
  it('builds no Intl formatter outside kept, anywhere in the window', () => {
    const offenders = Object.entries(SOURCES).flatMap(([path, source]) =>
      buildsIn(source).map(what => `${path} ${what}`),
    )

    expect(offenders).toEqual([])
  })

  /**
   * A guard nobody can trip is a guard nobody keeps.
   *
   * The first review of this file caught it promising more than it read: it knew three method
   * names and nothing else, so `new Intl.NumberFormat(language).format(value)` — the loose
   * formatter written the plain way, the very thing the batch removed — walked straight past it.
   */
  it('sees the loose formatter written either way, and the sentence naming neither', () => {
    expect(buildsIn('const s = value.toLocaleString(language)')).toEqual(['calls toLocaleString'])
    expect(buildsIn('const s = new Intl.NumberFormat(language).format(value)')).toEqual([
      'builds a loose Intl.NumberFormat',
    ])
    expect(buildsIn('const f = kept(M, language, () => new Intl.NumberFormat(language))')).toEqual(
      [],
    )
    expect(buildsIn('/** `toLocaleTimeString` builds a fresh one on every call. */')).toEqual([])
    expect(buildsIn("const name = 'toLocaleString'")).toEqual([])
  })
})
