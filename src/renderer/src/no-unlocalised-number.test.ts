import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every module of the window, as text. Read through Vite rather than through `fs`, like
 * `no-composed-percent.test.ts` beside it: the renderer has no filesystem.
 *
 * Components ONLY was the first shape of this rule, and it was wrong by exactly one file: a
 * ruler graduation is painted from a `.ts`, and it drew `0.5` at a French reader for months
 * under a green check. A number becomes a word wherever it is written, not only in JSX.
 */
const SOURCES: Record<string, string> = import.meta.glob(
  [
    './**/*.ts',
    './**/*.tsx',
    '!./**/*.test.ts',
    '!./**/*.test.tsx',
    '!./**/*-fixtures.ts',
    '!./**/*-fixtures.tsx',
  ],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * Where a rounder writes something no one reads as a number.
 *
 * One file, named rather than pattern-matched: shader source is a language of its own, and a
 * comma in a `vec3` is a second component. Adding a name here is the moment to ask whether the
 * number really is not about to be read.
 */
const NOT_FOR_READING = new Set(['./engines/skybox/projection-shader.ts'])

/**
 * `toFixed` returns a string, and the string is always English: `0.52` where a French reader
 * writes `0,52`. It reads as a rounder, which is why three surfaces drew numbers that way for
 * months without anyone seeing a translation problem.
 *
 * `formatDecimal` (`helpers/format.ts`) is the one that asks the language.
 */
function roundersIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const found: string[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      (node.name.text === 'toFixed' || node.name.text === 'toPrecision')
    ) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
      found.push(`${path}:${line} ${node.name.text}`)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return found
}

describe('the numbers a component draws', () => {
  it('are written by the formatter that asks the language, never by a rounder', () => {
    const rounded = Object.entries(SOURCES)
      .filter(([path]) => !NOT_FOR_READING.has(path))
      .flatMap(([path, code]) => roundersIn(path, code))

    expect(rounded).toEqual([])
  })

  it('would see one written the other way', () => {
    const code = 'const label = () => <p>{value.toFixed(2)}</p>'

    expect(roundersIn('probe.tsx', code)).toEqual(['probe.tsx:1 toFixed'])
  })
})
