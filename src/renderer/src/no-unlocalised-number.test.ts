import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every component of the window, as text. Read through Vite rather than through `fs`, like
 * `no-composed-percent.test.ts` beside it: the renderer has no filesystem.
 *
 * Components only. `toFixed` is a rounder, and rounding is legitimate everywhere a number is not
 * about to be read by a person — a GLSL literal, a canvas tick, a hash. What this rule protects
 * is the last step, where the number becomes a word.
 */
const SOURCES: Record<string, string> = import.meta.glob(
  ['./**/*.tsx', '!./**/*.test.tsx', '!./**/*-fixtures.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

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
    const rounded = Object.entries(SOURCES).flatMap(([path, code]) => roundersIn(path, code))

    expect(rounded).toEqual([])
  })

  it('would see one written the other way', () => {
    const code = 'const label = () => <p>{value.toFixed(2)}</p>'

    expect(roundersIn('probe.tsx', code)).toEqual(['probe.tsx:1 toFixed'])
  })
})
