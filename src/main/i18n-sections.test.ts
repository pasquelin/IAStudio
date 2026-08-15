import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'

// Here rather than beside the bundles: `shared/` is compiled by the web tsconfig too, which has
// no Node types, so a guard that reads the tree cannot live there.
const I18N = new URL('../shared/i18n/', import.meta.url)
const CODES: readonly Language[] = LANGUAGES.map(({ code }) => code)

function sectionFiles(language: Language): readonly string[] {
  return readdirSync(new URL(`${language}/`, I18N))
    .filter(name => name.endsWith('.json'))
    .sort()
}

function rootsOf(language: Language, file: string): readonly string[] {
  const parsed: unknown = JSON.parse(readFileSync(new URL(`${language}/${file}`, I18N), 'utf8'))
  if (parsed === null || typeof parsed !== 'object')
    throw new Error(`${language}/${file} is not an object`)
  return Object.keys(parsed)
}

/**
 * The bundles are split by functional surface, and they are the most contested path of the
 * repository — so they are also the most likely to be merged wrong. Each failure below loses
 * screen text without breaking anything the compiler or a rendering test would notice.
 */
describe('i18n sections', () => {
  it('has no flat locale file left beside the directories', () => {
    const flat = readdirSync(I18N).filter(name => CODES.some(code => name === `${code}.json`))

    // A merge conflict between a branch that split the bundle and one that edited the flat file
    // is offered as "deleted by us / modified by them", and keeping the flat file looks like the
    // safe answer. Measured: it is the worst one. `./fr` then resolves to `fr.json` rather than
    // to the directory, the named export is gone, and `TRANSLATIONS.fr` is undefined — the whole
    // language, not one key.
    expect(flat).toEqual([])
  })

  it('carries the same sections in every language', () => {
    const found = Object.fromEntries(CODES.map(code => [code, sectionFiles(code)]))
    const reference = sectionFiles(DEFAULT_LANGUAGE)

    expect(found).toEqual(Object.fromEntries(CODES.map(code => [code, reference])))
  })

  it.each(CODES)('spreads every section of %s into the bundle', language => {
    const claimed = new Map<string, string>()

    for (const file of sectionFiles(language))
      for (const root of rootsOf(language, file)) {
        // Two files claiming one root is not an error at run time: the later spread wins and the
        // earlier file becomes dead weight nobody sees is dead.
        expect(claimed.get(root)).toBeUndefined()
        claimed.set(root, file)
      }

    // A section file the directory index forgets to import parses fine and reaches nothing.
    expect([...claimed.keys()].sort()).toEqual(Object.keys(TRANSLATIONS[language]).sort())
  })
})
