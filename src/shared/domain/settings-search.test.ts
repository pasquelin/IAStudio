import { describe, expect, it } from 'vitest'
import { isRecord } from '../guards'
import { TRANSLATIONS } from '../i18n'
import { hitId, matchSettings, sectionsOf, type SearchHit } from './settings-search'

function resolve(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

const translate = (key: string): string => String(resolve(TRANSLATIONS.fr, key) ?? key)

const search = (query: string): readonly SearchHit[] => matchSettings(query, translate)

const found = (query: string): string[] => search(query).map(hitId)

describe('searching the settings', () => {
  it('finds a setting by its title', () => {
    expect(found('thème')).toContain('appearance.theme')
  })

  // A search box demanding a circumflex is a search box nobody uses.
  it('ignores accents and case', () => {
    expect(found('THEME')).toContain('appearance.theme')
  })

  it('searches the description too, where the words a user knows actually are', () => {
    expect(found('réseau')).toEqual(['generation.maxRetries'])
  })

  it('answers nothing to an empty query rather than everything', () => {
    expect(search('   ')).toEqual([])
  })

  it('answers nothing when nothing matches', () => {
    expect(search('kerning')).toEqual([])
  })
})

describe('searching beyond the settings', () => {
  // The window is three registries; a search finding only one of them sends people hunting
  // through tabs for the button or the shortcut they came for.
  it('finds a button, which holds no value at all', () => {
    expect(found('réinitialiser')).toContain('advanced.reset')
  })

  it('finds a command by what it does', () => {
    expect(found('tête de lecture')).toContain('sequence.start')
  })

  it('files every command under the shortcuts screen, whatever surface it acts on', () => {
    const hits = search('tête de lecture').filter(hit => hit.kind === 'command')

    expect(hits.every(hit => hit.section === 'shortcuts')).toBe(true)
  })
})

describe('the sections a result set touches', () => {
  it('lists them in the order the navigation does', () => {
    // `appearance` comes before `advanced` in the tree, whatever order the hits arrive in.
    const sections = sectionsOf([...search('réinitialiser'), ...search('thème')])

    expect(sections.indexOf('appearance')).toBeLessThan(sections.indexOf('advanced'))
  })

  it('names each section once, however many hits it holds', () => {
    const sections = sectionsOf(search('grille'))

    expect(new Set(sections).size).toBe(sections.length)
  })
})
