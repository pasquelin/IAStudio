import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { WINDOW_SOURCES } from './windowSources'

/** Every module of the window, as text — the sweep `windowSources.ts` holds for its guards. */
const SOURCES = WINDOW_SOURCES

/**
 * The names a percentage is allowed to wear when it is a CSS length rather than a sentence.
 *
 * A length is read by the layout engine, which has one syntax in every language. A closed list
 * rather than "any object property": `cancel={{ label: `${done} %` }}` is a property too, and
 * that label is read aloud. A new CSS property makes this check red — which is the right
 * failure, since adding a name here is the moment to ask whether it is really a length.
 */
const LENGTHS = new Set(['width', 'height', 'left', 'top', 'right', 'bottom', 'inset', 'size'])

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

/** `String(percent) + '%'` — the same sentence, built the other way. */
function concatenatesAPercentage(node: ts.BinaryExpression): boolean {
  return (
    node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    ts.isStringLiteral(node.right) &&
    node.right.text.trimStart().startsWith('%')
  )
}

/**
 * Whether the length is on its way to the layout engine, read off the name it is bound to.
 *
 * The name rather than the syntax: `style={{ width: … }}` and `const width = …` are the same
 * decision written twice, and a check that only knew the first would fail the day someone
 * lifted the expression out of the object.
 */
function isLength(node: ts.Node): boolean {
  const holder = node.parent
  if (ts.isPropertyAssignment(holder) && ts.isIdentifier(holder.name)) {
    return LENGTHS.has(holder.name.text)
  }
  if (ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) {
    return LENGTHS.has(holder.name.text)
  }
  return false
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
    const composes = ts.isTemplateExpression(node)
      ? composesAPercentage(node)
      : ts.isBinaryExpression(node) && concatenatesAPercentage(node)

    if (composes && !isLength(node)) {
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
      // The way round a refactor reaches for, and the reason the rule is not written on templates.
      "const D = () => String(percent) + '%'",
    ]

    expect(put.flatMap((code, index) => findingsIn(`probe${index}.tsx`, code))).toHaveLength(4)
  })

  // The hole a review found: any object property was exempt, and a spoken label is a property.
  it('would see one put in a prop that only looks like a style', () => {
    const found = findingsIn('probe.tsx', 'const A = () => <Row cancel={{ label: `${done} %` }} />')

    expect(found).toHaveLength(1)
  })

  // Where the rule stops: a length the layout engine reads, which has no language — named rather
  // than placed, so lifting it into a `const` keeps it exempt — and a sign that is not a
  // percentage at all, which is what the console's format directives are.
  it('leaves a width, an offset, a lifted length and a console directive alone', () => {
    const quiet = [
      'const A = () => <div style={{ width: `${percent}%` }} />',
      'const B = () => <div style={{ left: `${(at / duration) * 100}%` }} />',
      'const C = () => { const width = `${percent}%`; return <div style={{ width }} /> }',
      'const D = (scope: string) => `%c[main:${scope}]%c done`',
    ]

    expect(quiet.flatMap((code, index) => findingsIn(`probe${index}.tsx`, code))).toEqual([])
  })
})
