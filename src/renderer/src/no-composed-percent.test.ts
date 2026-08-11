import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every module of the window, as text. Read through Vite rather than through `fs`, like
 * `no-hardcoded-text.test.ts` reads the components: the renderer has no filesystem, and a test
 * living here does not get one.
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
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
)

/**
 * A sign put right after something computed — `${percent}%` as well as `${n} %`.
 *
 * Whatever separates the two is exactly the decision this rule takes away from the component, so
 * the separator is skipped rather than matched. A `%` anywhere else is not a percentage: the
 * console's own `%c` directive is one, and `useMainLogs` writes three.
 */
function composesAPercentage(node: ts.TemplateExpression): boolean {
  return node.templateSpans.some(span => span.literal.text.trimStart().startsWith('%'))
}

/**
 * A CSS length, not a sentence: `style={{ width: `${percent}%` }}`.
 *
 * A percentage painted as a width is read by the layout engine, which has one syntax in every
 * language. Being the value of an object property is what tells the two apart — nothing else in
 * the window builds a style string outside one.
 */
function isStyleValue(node: ts.TemplateExpression): boolean {
  return ts.isPropertyAssignment(node.parent)
}

function findingsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(
    path,
    code,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const findings: string[] = []

  function visit(node: ts.Node): void {
    if (ts.isTemplateExpression(node) && composesAPercentage(node) && !isStyleValue(node)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      findings.push(`${path}:${line + 1}`)
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

/**
 * The defect this closed: three call sites each wrote the separator between the number and the
 * sign by hand, and two of them wrote the French one — which an English reader was then shown.
 *
 * No existing guard could see it. A percent sign is not a word, so the bundles never held it,
 * and `no-hardcoded-text.test.ts` is right to let symbols through.
 */
describe('the renderer', () => {
  it('leaves every percentage it shows to `formatPercent`', () => {
    const findings = Object.entries(SOURCES).flatMap(([path, code]) => findingsIn(path, code))

    expect(findings).toEqual([])
  })

  it('holds every module, so the check covers the whole window', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(300)
  })

  it('would see a percentage composed in a spoken attribute or between tags', () => {
    const put = [
      'const A = () => <p aria-label={`${label} ${percent}%`} />',
      'const B = () => <span>{`${done} %`}</span>',
      'const C = () => `${scale * 100} %`',
    ]

    expect(put.flatMap((code, index) => findingsIn(`probe${index}.tsx`, code))).toHaveLength(3)
  })

  // Where the rule stops: a length the layout engine reads, which has no language — and a sign
  // that is not a percentage at all, which is what the console's format directives are.
  it('leaves a width, an offset and a console directive alone', () => {
    const quiet = [
      'const A = () => <div style={{ width: `${percent}%` }} />',
      'const B = () => <div style={{ left: `${(at / duration) * 100}%` }} />',
      'const C = (scope: string) => `%c[main:${scope}]%c done`',
    ]

    expect(quiet.flatMap((code, index) => findingsIn(`probe${index}.tsx`, code))).toEqual([])
  })
})
