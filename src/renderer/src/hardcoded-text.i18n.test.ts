import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/** Every file the renderer ships, as text — read through Vite, as `known-keys.i18n.test.ts` does. */
const SOURCES: Record<string, string> = import.meta.glob(['./**/*.tsx', '!./**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Attributes whose value a human reads on screen rather than a browser. */
const TEXT_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-valuetext',
  'caption',
  'emptyLabel',
  'heading',
  'hint',
  'label',
  'legend',
  'message',
  'placeholder',
  'summary',
  'title',
  'tooltip',
])

type Sighting = { line: number; shape: string; text: string }

/** Two letters together are a word; a lone symbol, a number or an entity is not. */
function reads(text: string): boolean {
  return /[A-Za-zÀ-ÿ]{2,}/.test(text)
}

/** The literal a JSX child carries, whichever of the three ways it was written. */
function childLiteral(expression: ts.Expression): string | null {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    return expression.text
  if (ts.isTemplateExpression(expression))
    return expression.head.text + expression.templateSpans.map(span => span.literal.text).join(' ')
  return null
}

/** The literal an attribute carries, bare or wrapped in braces. */
function attributeLiteral(initializer: ts.JsxAttributeValue): string | null {
  if (ts.isStringLiteral(initializer)) return initializer.text
  if (ts.isJsxExpression(initializer) && initializer.expression)
    return childLiteral(initializer.expression)
  return null
}

function sightingsIn(path: string, code: string): Sighting[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Sighting[] = []

  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node) && reads(node.text.trim())) {
      found.push({ line: lineOf(node), shape: 'text', text: node.text.trim() })
    }

    // `<p>{'Some text'}</p>` is a child too, just not a JsxText. An attribute's braces look the
    // same to the parser, hence the parent check.
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      !ts.isJsxAttribute(node.parent) &&
      reads(childLiteral(node.expression) ?? '')
    ) {
      found.push({ line: lineOf(node), shape: 'child', text: childLiteral(node.expression) ?? '' })
    }

    if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(source)
      const literal = attributeLiteral(node.initializer)
      if (literal !== null && TEXT_ATTRIBUTES.has(name) && reads(literal)) {
        found.push({ line: lineOf(node), shape: name, text: literal })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return found
}

/**
 * A sentence written into a component ships in one language and answers to no bundle. The other
 * i18n tests all read the same direction — a key the source names must exist in both bundles.
 * This is the direction none of them covers: text that never asked for a key at all.
 *
 * Scope is JSX, where what the user reads lives. A label the main process hands to the native
 * menu or a dialog is not seen from here; those go through the `t` object of `menu/template.ts`,
 * and `shared/i18n/bundles.test.ts` keeps the two bundles honest with each other.
 */
describe('the text a component would ship untranslated', () => {
  it('is nowhere in the renderer', () => {
    const sighted = Object.entries(SOURCES).flatMap(([path, source]) =>
      sightingsIn(path, source).map(
        ({ line, shape, text }) => `${path}:${line} [${shape}] ${text}`,
      ),
    )

    expect(sighted).toEqual([])
  })

  it('would see a sentence left in a component, however it was written', () => {
    const probe = [
      'export const Probe = () => (',
      '  <div title="Open a project first">',
      '    Nothing here yet',
      "    {'Also this sentence'}",
      '  </div>',
      ')',
    ].join('\n')

    expect(sightingsIn('probe.tsx', probe).map(({ shape }) => shape)).toEqual([
      'title',
      'text',
      'child',
    ])
  })

  it('leaves alone what carries no words', () => {
    const probe = ['export const Probe = () => (', '  <span aria-hidden>×</span>', ')'].join('\n')

    expect(sightingsIn('probe.tsx', probe)).toEqual([])
  })
})
