import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'

/** Every file the renderer ships, as text — read through Vite, as `tokens.test.ts` does. */
const SOURCES: Record<string, string> = import.meta.glob(
  ['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx'],
  { query: '?raw', import: 'default', eager: true },
)

/**
 * i18next appends a plural category to the key it looks up, so a bundle holds `pushed_one` and
 * `pushed_other` where the caller wrote `pushed`. English and French use two of them; the list
 * is CLDR's, so a language with more can be added without touching this.
 */
const PLURAL_SUFFIXES = ['', '_zero', '_one', '_two', '_few', '_many', '_other']

function resolve(code: Language, key: string): unknown {
  // Widened, not cast: the bundle's inferred type has no index signature.
  const bundle: unknown = TRANSLATIONS[code]
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

function isKnown(code: Language, key: string): boolean {
  return PLURAL_SUFFIXES.some(suffix => typeof resolve(code, `${key}${suffix}`) === 'string')
}

/** `t('…')`, and the `…Key` fields the registries carry so a row names itself from a bundle. */
function keysIn(path: string, code: string): { key: string; line: number }[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const keys: { key: string; line: number }[] = []

  const take = (node: ts.Node, literal: ts.StringLiteral): void => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    keys.push({ key: literal.text, line: line + 1 })
  }

  const visit = (node: ts.Node): void => {
    // `t(…)` or `i18next.t(…)`, and nothing else that happens to end in a `t` — `import(…)`
    // does, and it took a dynamic import of `opentype.js` to notice.
    const callee = ts.isCallExpression(node) ? node.expression.getText(source) : ''

    // Only the first argument: the second is a fallback, not another key.
    if (ts.isCallExpression(node) && (callee === 't' || callee.endsWith('.t'))) {
      const [first] = node.arguments
      if (first !== undefined && ts.isStringLiteral(first) && first.text.includes('.')) {
        take(node, first)
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source).endsWith('Key') &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text.includes('.')
    ) {
      take(node, node.initializer)
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return keys
}

/**
 * A key written by hand and never added to the bundles reads as itself on screen — i18next
 * answers with the key it was given rather than failing. Nothing else here catches that: the
 * composed keys are checked against their registries, and this is the other half.
 */
describe('every key the renderer names outright', () => {
  it.each(LANGUAGES.map(language => language.code))('is in the %s bundle', code => {
    const missing = Object.entries(SOURCES).flatMap(([path, source]) =>
      keysIn(path, source)
        .filter(({ key }) => !isKnown(code, key))
        .map(({ key, line }) => `${path}:${line} ${key}`),
    )

    expect(missing).toEqual([])
  })

  it('accepts a key the bundle only holds in plural form', () => {
    expect(isKnown('fr', 'assets.count')).toBe(true)
  })

  it('would see a key nobody translated', () => {
    expect(isKnown('fr', 'jobs.thereIsNoSuchKey')).toBe(false)
  })
})
