import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every component, as text. Read through Vite rather than through `fs`, like `tokens.test.ts`
 * reads the stylesheet: the renderer has no filesystem, and a test living here does not get one.
 */
const COMPONENTS: Record<string, string> = import.meta.glob(['./**/*.tsx', '!./**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/**
 * Attributes whose value is read out — on screen or by a screen reader. `className`, `role` and
 * `aria-live` are deliberately absent: their literals are class names and ARIA keywords, not
 * words anyone reads.
 */
const SPOKEN_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'caption',
  'description',
  'heading',
  'hint',
  'label',
  'message',
  'placeholder',
  'summary',
  'title',
  'tooltip',
])

/**
 * Attributes whose literal is never a word: class names, urls, SVG paths, React keys. They are
 * the only ones allowed to hold spaces and capitals, and `className` above all does both.
 */
const TECHNICAL_ATTRIBUTES = new Set([
  'className',
  // Key identifiers the spec fixes — `Alt+ArrowLeft`, never `Alt+FlècheGauche`. The screen
  // reader is the one that names them in the reader's language.
  'aria-keyshortcuts',
  'style',
  'src',
  'href',
  'd',
  'viewBox',
  'key',
  'id',
])

/** A word, rather than a symbol, a number or a separator that reads the same in any language. */
function isWords(text: string): boolean {
  return /\p{Letter}{2}/u.test(text)
}

/**
 * A phrase rather than an enum member. Every literal the components pass today is a lowercase
 * keyword — `horizontal`, `background-removal`, `preserveStartEnd` — so a capital at the front
 * or a space between two words is what tells a sentence from a setting.
 *
 * This is what catches a prop the list below has never heard of: a design-system component
 * gaining a `nameHeader` or an `emptyMessage` needs no edit here to be covered.
 */
function looksLikeSentence(text: string): boolean {
  return (
    /\p{Letter}\s+\p{Letter}/u.test(text) || /^\p{Uppercase_Letter}\p{Lowercase_Letter}/u.test(text)
  )
}

/** `&&`, `||` and `??` pick between two things a user may read. `===` compares; it shows nothing. */
const LOGICAL_OPERATORS = new Set([
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
])

/**
 * Every word an expression spells out — one entry per branch, because `cond ? 'A' : 'B'` shows
 * one or the other and both are words. A template keeps only its literal parts: the holes are
 * values, and `${a}${b}` says nothing in any language.
 *
 * Walking into a comparison would be a mistake, not an omission: the `'left'` of `side === 'left'`
 * is an operand. Eight of them sit in the components today, and every one would be a false alarm.
 */
function literalsIn(expression: ts.Expression): string[] {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    return [expression.text]
  if (ts.isTemplateExpression(expression))
    return [
      expression.head.text + expression.templateSpans.map(span => span.literal.text).join(' '),
    ]
  if (ts.isConditionalExpression(expression))
    return [...literalsIn(expression.whenTrue), ...literalsIn(expression.whenFalse)]
  if (ts.isBinaryExpression(expression) && LOGICAL_OPERATORS.has(expression.operatorToken.kind))
    return [...literalsIn(expression.left), ...literalsIn(expression.right)]
  if (ts.isParenthesizedExpression(expression)) return literalsIn(expression.expression)
  return []
}

/** What an attribute was given, whether or not it wears braces — `title="x"` and `title={'x'}`. */
function attributeValues(initializer: ts.JsxAttributeValue): string[] {
  if (ts.isJsxExpression(initializer))
    return initializer.expression ? literalsIn(initializer.expression) : []
  return literalsIn(initializer)
}

function findingsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const findings: string[] = []

  const note = (node: ts.Node, text: string): void => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    findings.push(`${path}:${line + 1} ${text.trim()}`)
  }

  const visit = (node: ts.Node): void => {
    // Text sitting between tags: `<span>Ready</span>`.
    if (ts.isJsxText(node) && isWords(node.text)) note(node, node.text)

    // A literal handed over in braces is a child too, just not a JsxText. An attribute's braces
    // are the same node, hence the parent check.
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      for (const text of literalsIn(node.expression)) if (isWords(text)) note(node, text)
    }

    // An attribute given a literal. A spoken one may not hold a word at all; any other one may
    // hold a keyword, but not a sentence. A technical one can be neither, so it is dropped before
    // its value is read at all — that is most of the attributes in the window.
    if (ts.isJsxAttribute(node) && node.initializer !== undefined) {
      const name = node.name.getText(source)
      if (!TECHNICAL_ATTRIBUTES.has(name)) {
        for (const value of attributeValues(node.initializer)) {
          const spoken = SPOKEN_ATTRIBUTES.has(name) && isWords(value)
          if (spoken || looksLikeSentence(value)) note(node, `${name}="${value}"`)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

/**
 * The rule the whole interface rests on: every word on screen comes from a bundle, so the studio
 * reads in French or in English without a component knowing which.
 *
 * Read off the syntax tree rather than grepped. `=>` closes a tag as far as a regular expression
 * is concerned, and a check that cries wolf is a check somebody turns off.
 */
describe('the renderer', () => {
  it('leaves every word it shows to the bundles', () => {
    const findings = Object.entries(COMPONENTS).flatMap(([path, code]) => findingsIn(path, code))

    expect(findings).toEqual([])
  })

  it('holds every component, so the check covers the whole window', () => {
    expect(Object.keys(COMPONENTS).length).toBeGreaterThan(100)
  })

  it('would see a word put back, between tags or in a spoken attribute', () => {
    const found = findingsIn('probe.tsx', 'const A = () => <p aria-label="Close">Ready</p>')

    expect(found.map(finding => finding.split(' ').slice(1).join(' ')).sort()).toEqual([
      'Ready',
      'aria-label="Close"',
    ])
  })

  // The blind spot this closed: a prop the list of spoken attributes has never heard of.
  it('would see a word put into a prop it has never heard of', () => {
    const found = findingsIn('probe.tsx', 'const A = () => <Table nameHeader="Action" />')

    expect(found).toHaveLength(1)
  })

  // The second blind spot: braces. A literal reads the same to a user whether or not it wears
  // them, but they are two different nodes to the parser, and only the bare one was looked at.
  it('would see a word put in braces, as a child or as an attribute', () => {
    const found = findingsIn('probe.tsx', "const A = () => <p title={'Close'}>{'Ready'}</p>")

    expect(found.map(finding => finding.split(' ').slice(1).join(' ')).sort()).toEqual([
      'Ready',
      'title="Close"',
    ])
  })

  it('would see a word left in a template that interpolates', () => {
    const found = findingsIn('probe.tsx', 'const A = () => <p>{`${count} assets pushed`}</p>')

    expect(found).toHaveLength(1)
  })

  // The third blind spot, and the likeliest of them: a ternary and a `&&` are what a developer
  // reaches for to swap a raw string in where a `t(…)` belongs.
  it('would see a word held behind a ternary or a guard', () => {
    const behind = [
      "const A = () => <p>{ok ? 'Loading your project' : 'Nothing to show'}</p>",
      "const B = () => <p>{bad && 'Something went wrong'}</p>",
    ]

    expect(behind.flatMap((code, index) => findingsIn(`probe${index}.tsx`, code))).toHaveLength(3)
  })

  // Where the recursion stops, and why, is on `literalsIn`.
  it('leaves the operand of a comparison alone', () => {
    const found = findingsIn('probe.tsx', "const A = () => <p>{side === 'left' && <X />}</p>")

    expect(found).toEqual([])
  })

  // Dropping a technical attribute before its value is read assumes the two lists never meet: a
  // name in both would be gone before the spoken rule ever saw it.
  it('keeps the two lists of attributes apart', () => {
    const both = [...SPOKEN_ATTRIBUTES].filter(name => TECHNICAL_ATTRIBUTES.has(name))

    expect(both).toEqual([])
  })

  it('leaves class names, ARIA keywords and symbols alone', () => {
    const quiet = [
      'const A = () => <p className="flex gap-2 truncate" role="group" aria-live="polite" />',
      "const B = () => <span>{t('jobs.none')}</span>",
      'const C = () => <span> · </span>',
      'const D = () => <img alt="" src={url} />',
      'const E = () => <Bar orientation="horizontal" variant="header" zone="top" />',
      'const F = () => <Line dataKey="units" interval="preserveStartEnd" height="100%" />',
      'const G = () => <svg viewBox="0 0 24 24" />',
    ]

    expect(quiet.flatMap((code, index) => findingsIn(`probe${index}.tsx`, code))).toEqual([])
  })
})
