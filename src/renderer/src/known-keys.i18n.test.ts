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
type Interpolated = { key: string; given: readonly string[]; line: number }

/** The names an options object hands over — `t('x', { name, count })`. */
function namesOf(options: ts.ObjectLiteralExpression, source: ts.SourceFile): string[] {
  return options.properties.flatMap(property => {
    const name = property.name?.getText(source)
    return name === undefined ? [] : [name.replace(/['"]/g, '')]
  })
}

/** `{{name}}`, and every other hole the sentence expects its caller to fill. */
function holesOf(text: unknown): string[] {
  // The capture is there whenever the pattern matched, but the compiler counts it optional.
  return [...String(text).matchAll(/\{\{(\w+)/g)].flatMap(match =>
    match[1] === undefined ? [] : [match[1]],
  )
}

function keysIn(
  path: string,
  code: string,
): { keys: { key: string; line: number }[]; filled: Interpolated[] } {
  // No `ScriptKind`: TypeScript reads it off the name, and forcing TSX on a `.ts` was worse than
  // useless — `const f = <T,>(x: T) => x` opens a tag, the parser drops into error recovery, and
  // nothing after it is visited. Measured on this glob: 697 nodes of `app/document-io.ts` seen
  // out of 1653, and 483 of `engines/graph/serialize.ts` out of 866.
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const keys: { key: string; line: number }[] = []
  const filled: Interpolated[] = []

  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

  const take = (node: ts.Node, literal: ts.StringLiteral): void => {
    keys.push({ key: literal.text, line: lineOf(node) })
  }

  const visit = (node: ts.Node): void => {
    // `t(…)` or `i18next.t(…)`, and nothing else that happens to end in a `t` — `import(…)`
    // does, and it took a dynamic import of `opentype.js` to notice.
    const callee = ts.isCallExpression(node) ? node.expression.getText(source) : ''

    // Only the first argument: the second is a fallback, not another key.
    if (ts.isCallExpression(node) && (callee === 't' || callee.endsWith('.t'))) {
      const [first, second] = node.arguments
      if (first !== undefined && ts.isStringLiteral(first) && first.text.includes('.')) {
        take(node, first)
        if (second !== undefined && ts.isObjectLiteralExpression(second)) {
          filled.push({ key: first.text, given: namesOf(second, source), line: lineOf(node) })
        }
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
  return { keys, filled }
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
        .keys.filter(({ key }) => !isKnown(code, key))
        .map(({ key, line }) => `${path}:${line} ${key}`),
    )

    expect(missing).toEqual([])
  })

  it('accepts a key the bundle only holds in plural form', () => {
    expect(isKnown('fr', 'assets.count')).toBe(true)
  })

  /**
   * The half of a module this check could not see. Nothing was lost — the one key-shaped literal
   * behind a generic arrow turned out to be a `LogScope` — but the check that catches the
   * costliest defect of all, a raw key on screen, was reading half of three modules.
   */
  it('reads a module whose generic arrow used to open a tag', () => {
    // Without the comma, which is how `app/document-io.ts:105` writes it — `<T,>` stays a
    // generic even in TSX, so a probe using it would pass whatever the mode.
    const code = "const asIs = <S>(state: S): unknown => state\nconst title = t('panels.assets')"

    expect(keysIn('probe.ts', code).keys.map(found => found.key)).toEqual(['panels.assets'])
  })

  it('still reads a component, where the arrow really is a tag', () => {
    const code = "const View = () => <p>{t('panels.assets')}</p>"

    expect(keysIn('probe.tsx', code).keys.map(found => found.key)).toEqual(['panels.assets'])
  })

  it('would see a key nobody translated', () => {
    expect(isKnown('fr', 'jobs.thereIsNoSuchKey')).toBe(false)
  })
})

/**
 * A sentence with a hole left unfilled draws the hole: i18next writes `{{name}}` where the name
 * belongs, and says nothing about it. The bundles are checked against each other for holes; this
 * checks them against the callers, which is the other half.
 *
 * Only calls that pass an options object outright are read — a body assembled elsewhere and
 * handed over under one name is beyond a check that reads a file at a time.
 */
describe('the holes a sentence leaves for its caller', () => {
  it('are all filled where the caller writes them out', () => {
    const unfilled = Object.entries(SOURCES).flatMap(([path, source]) =>
      keysIn(path, source).filled.flatMap(({ key, given, line }) => {
        const text =
          resolve('fr', key) ?? resolve('fr', `${key}_other`) ?? resolve('fr', `${key}_one`)
        const missing = holesOf(text).filter(hole => !given.includes(hole))
        return text === undefined || missing.length === 0
          ? []
          : [`${path}:${line} ${key} ${missing}`]
      }),
    )

    expect(unfilled).toEqual([])
  })

  it('reads the holes out of a sentence, plural forms included', () => {
    expect(holesOf('{{count}} asset pushed to {{where}}')).toEqual(['count', 'where'])
    expect(holesOf('nothing to fill')).toEqual([])
  })
})
