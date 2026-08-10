import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_LIMIT_MAX,
  HOME_LIMIT_MIN,
  HOME_SECTIONS,
  canMoveHomeSection,
  homeSections,
  hiddenHomeSections,
  homeSectionLimit,
  homeSectionOf,
  limitedHomeSection,
  movedHomeSection,
  shownHomeSection,
  visibleHomeSections,
  type HomeContext,
  type HomeSectionId,
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
    expect(sections).toContain('documents')
  })

  /**
   * The activity band draws the same `useActivity` entries as the bottom panel, which is always
   * on screen: a default install showed the same lines twice. Hidden, not removed — the section
   * menu offers it back like any other.
   */
  it('leaves a band that duplicates another surface off a fresh install', () => {
    const sections = visibleHomeSections(DEFAULT_HOME_SECTIONS, {
      authenticated: true,
      hasProject: true,
    })

    expect(sections).not.toContain('activity')
    expect(hiddenHomeSections(DEFAULT_HOME_SECTIONS)).toContain('activity')
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

    // Every band but the anchored one, which is held at the foot however it was stored.
    const expected = reversed.map(setting => setting.id).filter(id => id !== 'explore')
    expect(sections).toEqual([...expected, 'explore'])
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
    const order = moved.map(setting => setting.id)

    expect(order.indexOf('projects')).toBe(order.indexOf('tools') - 1)
  })

  it('refuses a move at either end of the column it belongs to', () => {
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', 'up')).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'explore', 'down')).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'projects', 'up')).toBe(true)
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

describe('a band that never ends', () => {
  it('is held at the foot of the page whatever the stored order says', () => {
    // Settings written by an earlier version, or by hand, must not land it mid-page.
    const scrambled: HomeSectionSetting[] = [
      { id: 'explore', visible: true },
      { id: 'tools', visible: true },
    ]

    expect(homeSections(scrambled).at(-1)?.id).toBe('explore')
  })

  it('cannot be moved, in either direction', () => {
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'explore', 'up')).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'explore', 'down')).toBe(false)
    expect(movedHomeSection(DEFAULT_HOME_SECTIONS, 'explore', 'up').at(-1)?.id).toBe('explore')
  })

  it('cannot be passed under either, since that is the same burial', () => {
    const before = homeSections(DEFAULT_HOME_SECTIONS).at(-2)
    expect(before).toBeDefined()
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, before?.id ?? 'tools', 'down')).toBe(false)
  })
})

describe('moving a band past the ones nobody is shown', () => {
  it('skips a neighbour the studio is not drawing', () => {
    // Swapping with a hidden band changes the stored order and nothing on screen — an enabled
    // row that does nothing, which is what `canMoveHomeSection` exists to prevent.
    const shown: HomeSectionId[] = ['spotlight', 'projects']
    const moved = movedHomeSection(DEFAULT_HOME_SECTIONS, 'projects', 'up', shown)
    const order = moved.map(setting => setting.id)

    expect(order.indexOf('projects')).toBeLessThan(order.indexOf('spotlight'))
  })

  it('refuses when every neighbour on that side is hidden', () => {
    const shown: HomeSectionId[] = ['projects']
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'projects', 'up', shown)).toBe(false)
  })
})
