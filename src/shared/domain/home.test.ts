import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_LIMIT_MAX,
  HOME_LIMIT_MIN,
  HOME_SECTIONS,
  hiddenHomeSections,
  homeSectionLimit,
  homeSectionOf,
  limitedHomeSection,
  movedHomeSection,
  shownHomeSection,
  visibleHomeSections,
  type HomeContext,
  type HomeSectionSetting,
} from './home'

const CONTEXTS: HomeContext[] = [
  { authenticated: true, hasProject: true },
  { authenticated: true, hasProject: false },
  { authenticated: false, hasProject: true },
  { authenticated: false, hasProject: false },
]

const ALL_HIDDEN: HomeSectionSetting[] = HOME_SECTIONS.map(entry => ({
  id: entry.id,
  visible: false,
}))

describe('the pinned sections', () => {
  it('require nothing, which is what makes an empty home impossible', () => {
    for (const entry of HOME_SECTIONS.filter(candidate => candidate.pinned === true)) {
      expect(entry.requires).toEqual([])
    }
  })
})

describe('the sections a home draws', () => {
  it('is never empty, whatever is missing and whatever the user hid', () => {
    for (const context of CONTEXTS) {
      for (const stored of [DEFAULT_HOME_SECTIONS, ALL_HIDDEN, []]) {
        expect(visibleHomeSections(stored, context).length).toBeGreaterThan(0)
      }
    }
  })

  it('drops what needs a key when there is none, rather than drawing it empty', () => {
    const sections = visibleHomeSections(DEFAULT_HOME_SECTIONS, {
      authenticated: false,
      hasProject: true,
    })

    expect(sections).not.toContain('jobs')
    expect(sections).toContain('activity')
  })

  it('drops what needs a project when none is open', () => {
    const sections = visibleHomeSections(DEFAULT_HOME_SECTIONS, {
      authenticated: true,
      hasProject: false,
    })

    expect(sections).not.toContain('documents')
    expect(sections).not.toContain('activity')
    expect(sections).toContain('jobs')
  })

  it('honours the stored order rather than the registry one', () => {
    const reversed = [...DEFAULT_HOME_SECTIONS].reverse()
    const sections = visibleHomeSections(reversed, { authenticated: true, hasProject: true })

    expect(sections).toEqual(reversed.map(setting => setting.id))
  })

  it('hides a section the user hid, and keeps the pinned one they tried to', () => {
    const sections = visibleHomeSections(ALL_HIDDEN, { authenticated: true, hasProject: true })

    expect(sections).toContain('spotlight')
    expect(sections).not.toContain('documents')
  })
})

describe('reading back a stored order', () => {
  it('ignores a section this version no longer knows', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'gone', visible: true },
      { id: 'documents', visible: true },
    ]

    // `as` because that id no longer exists in the union — which is the case the guard is for.
    const sections = visibleHomeSections(fromDisk as HomeSectionSetting[], {
      authenticated: true,
      hasProject: true,
    })

    expect(sections).toContain('documents')
    expect(sections).not.toContain('gone')
  })

  it('adds a section this version gained, next to the one it was designed to follow', () => {
    const withoutTools: HomeSectionSetting[] = DEFAULT_HOME_SECTIONS.filter(
      setting => setting.id !== 'tools',
    )

    const sections = visibleHomeSections(withoutTools, { authenticated: true, hasProject: true })

    expect(sections.indexOf('tools')).toBe(sections.indexOf('spotlight') + 1)
  })
})

describe('how many items a section asks for', () => {
  it('prefers the stored number to the registry default', () => {
    const stored: HomeSectionSetting[] = [{ id: 'projects', visible: true, limit: 3 }]

    expect(homeSectionLimit(stored, 'projects')).toBe(3)
    expect(homeSectionLimit([], 'projects')).toBe(homeSectionOf('projects')?.defaultLimit)
  })
})

describe('rearranging the home', () => {
  it('swaps a section with its neighbour', () => {
    const moved = movedHomeSection(DEFAULT_HOME_SECTIONS, 'projects', 'up')

    expect(moved.map(setting => setting.id).slice(0, 3)).toEqual(['spotlight', 'projects', 'tools'])
  })

  it('leaves the order alone at either end', () => {
    const first = HOME_SECTIONS[0]?.id ?? 'spotlight'
    const last = HOME_SECTIONS.at(-1)?.id ?? 'activity'

    expect(movedHomeSection(DEFAULT_HOME_SECTIONS, first, 'up').map(s => s.id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(s => s.id),
    )
    expect(movedHomeSection(DEFAULT_HOME_SECTIONS, last, 'down').map(s => s.id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(s => s.id),
    )
  })

  it('keeps every section when the stored list predates one', () => {
    const partial: HomeSectionSetting[] = [{ id: 'activity', visible: true }]

    expect(movedHomeSection(partial, 'activity', 'up')).toHaveLength(HOME_SECTIONS.length)
  })

  it('hides and shows a section, and offers the hidden ones back', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'documents', false)

    expect(hiddenHomeSections(hidden)).toEqual(['documents'])
    expect(hiddenHomeSections(shownHomeSection(hidden, 'documents', true))).toEqual([])
  })

  it('never offers a pinned section back, since it was never taken away', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'tools', false)

    expect(hiddenHomeSections(hidden)).toEqual([])
  })

  it('clamps a limit to what the settings would accept', () => {
    const tiny = limitedHomeSection(DEFAULT_HOME_SECTIONS, 'projects', 1)
    const huge = limitedHomeSection(DEFAULT_HOME_SECTIONS, 'projects', 9000)

    expect(homeSectionLimit(tiny, 'projects')).toBe(HOME_LIMIT_MIN)
    expect(homeSectionLimit(huge, 'projects')).toBe(HOME_LIMIT_MAX)
  })
})
