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

    // An attribute given a literal. A spoken one may not hold a word at all; any other one may
    // hold a keyword, but not a sentence.
    if (
      ts.isJsxAttribute(node) &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer)
    ) {
      const name = node.name.getText(source)
      const value = node.initializer.text
      const spoken = SPOKEN_ATTRIBUTES.has(name) && isWords(value)
      const sentence = !TECHNICAL_ATTRIBUTES.has(name) && looksLikeSentence(value)

      if (spoken || sentence) note(node, `${name}="${value}"`)
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
