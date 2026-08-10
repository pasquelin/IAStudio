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
import { TOOL_PLACEMENTS } from './tool'

const CONTEXTS: HomeContext[] = [{ authenticated: true }, { authenticated: false }]

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

/**
 * The two registries answer different questions — what the centre stacks, and what the rails
 * hold — and an id in both would be one thing drawn twice, which is exactly what the six that
 * moved were doing.
 */
describe('the sections and the panels', () => {
  it('never name the same thing', () => {
    // Widened to `string` on purpose: the two unions are disjoint, so TypeScript refuses the
    // comparison outright — which proves it at compile time and would leave nothing running
    // here. This holds the same rule for a registry read back at runtime.
    const panels: readonly string[] = TOOL_PLACEMENTS.map(placement => placement.id)
    const shared = HOME_SECTIONS.map(entry => entry.id).filter(id => panels.includes(id))

    expect(shared).toEqual([])
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
    const sections = visibleHomeSections(DEFAULT_HOME_SECTIONS, { authenticated: false })

    expect(sections).not.toContain('jobs')
    expect(sections).toContain('favorites')
  })

  it('shows every band on a fresh install: what one hides, one hid', () => {
    const sections = visibleHomeSections(DEFAULT_HOME_SECTIONS, { authenticated: true })

    expect(sections).toEqual(HOME_SECTIONS.map(entry => entry.id))
  })

  it('honours the stored order rather than the registry one', () => {
    const reversed = [...DEFAULT_HOME_SECTIONS].reverse()
    const sections = visibleHomeSections(reversed, { authenticated: true })

    // Every band but the anchored one, which is held at the foot however it was stored.
    const expected = reversed.map(setting => setting.id).filter(id => id !== 'explore')
    expect(sections).toEqual([...expected, 'explore'])
  })

  it('hides a section the user hid, and keeps the pinned one they tried to', () => {
    const sections = visibleHomeSections(ALL_HIDDEN, { authenticated: true })

    expect(sections).toContain('spotlight')
    expect(sections).not.toContain('favorites')
  })
})

describe('reading back a stored order', () => {
  it('ignores a section this version no longer knows', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'gone', visible: true },
      { id: 'favorites', visible: true },
    ]

    // `as` because that id no longer exists in the union — which is the case the guard is for.
    const sections = visibleHomeSections(fromDisk as HomeSectionSetting[], { authenticated: true })

    expect(sections).toContain('favorites')
    expect(sections).not.toContain('gone')
  })

  /**
   * The settings of anyone who ran the studio before 10 August name six bands that are panels
   * now. Nothing migrates them: they are dropped on the way in, which is what keeps a panel from
   * being listed as a band nobody can draw.
   */
  it('drops the ids that became panels, without touching the rest', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'projects', visible: true },
      { id: 'activity', visible: true },
      { id: 'byMode', visible: true },
      { id: 'tools', visible: true },
    ]

    const kept = homeSections(fromDisk as HomeSectionSetting[]).map(setting => setting.id)

    expect(kept).not.toContain('projects')
    expect(kept).not.toContain('activity')
    expect(kept).not.toContain('byMode')
    expect(kept).toContain('tools')
    // The ones it never knew about arrive at their designed place rather than being lost.
    expect(kept).toHaveLength(HOME_SECTIONS.length)
  })

  it('adds a section this version gained, next to the one it was designed to follow', () => {
    const withoutTools: HomeSectionSetting[] = DEFAULT_HOME_SECTIONS.filter(
      setting => setting.id !== 'tools',
    )

    const sections = visibleHomeSections(withoutTools, { authenticated: true })

    expect(sections.indexOf('tools')).toBe(sections.indexOf('spotlight') + 1)
  })
})

describe('how many items a section asks for', () => {
  it('prefers the stored number to the registry default', () => {
    const stored: HomeSectionSetting[] = [{ id: 'favorites', visible: true, limit: 3 }]

    expect(homeSectionLimit(stored, 'favorites')).toBe(3)
    expect(homeSectionLimit([], 'favorites')).toBe(homeSectionOf('favorites')?.defaultLimit)
  })
})

describe('rearranging the home', () => {
  it('swaps a section with its neighbour', () => {
    const moved = movedHomeSection(DEFAULT_HOME_SECTIONS, 'favorites', 'up')
    const order = moved.map(setting => setting.id)

    expect(order.indexOf('favorites')).toBe(order.indexOf('tools') - 1)
  })

  it('refuses a move at either end of the column it belongs to', () => {
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', 'up')).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'explore', 'down')).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'favorites', 'up')).toBe(true)
  })

  it('leaves the order alone at either end', () => {
    const first = HOME_SECTIONS[0]?.id ?? 'spotlight'
    const last = HOME_SECTIONS.at(-1)?.id ?? 'explore'

    expect(movedHomeSection(DEFAULT_HOME_SECTIONS, first, 'up').map(s => s.id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(s => s.id),
    )
    expect(movedHomeSection(DEFAULT_HOME_SECTIONS, last, 'down').map(s => s.id)).toEqual(
      DEFAULT_HOME_SECTIONS.map(s => s.id),
    )
  })

  it('keeps every section when the stored list predates one', () => {
    const partial: HomeSectionSetting[] = [{ id: 'usage', visible: true }]

    expect(movedHomeSection(partial, 'usage', 'up')).toHaveLength(HOME_SECTIONS.length)
  })

  it('hides and shows a section, and offers the hidden ones back', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'usage', false)

    expect(hiddenHomeSections(hidden)).toEqual(['usage'])
    expect(hiddenHomeSections(shownHomeSection(hidden, 'usage', true))).toEqual([])
  })

  it('never offers a pinned section back, since it was never taken away', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'tools', false)

    expect(hiddenHomeSections(hidden)).toEqual([])
  })

  it('clamps a limit to what the settings would accept', () => {
    const tiny = limitedHomeSection(DEFAULT_HOME_SECTIONS, 'favorites', 1)
    const huge = limitedHomeSection(DEFAULT_HOME_SECTIONS, 'favorites', 9000)

    expect(homeSectionLimit(tiny, 'favorites')).toBe(HOME_LIMIT_MIN)
    expect(homeSectionLimit(huge, 'favorites')).toBe(HOME_LIMIT_MAX)
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
    const shown: HomeSectionId[] = ['spotlight', 'favorites']
    const moved = movedHomeSection(DEFAULT_HOME_SECTIONS, 'favorites', 'up', shown)
    const order = moved.map(setting => setting.id)

    expect(order.indexOf('favorites')).toBeLessThan(order.indexOf('spotlight'))
  })

  it('refuses when every neighbour on that side is hidden', () => {
    const shown: HomeSectionId[] = ['favorites']
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'favorites', 'up', shown)).toBe(false)
  })
})
