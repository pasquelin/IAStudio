import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTIONS,
  canMoveHomeSection,
  homeSections,
  hiddenHomeSections,
  homeSectionOf,
  movedHomeSection,
  shownHomeSection,
  visibleHomeSections,
  type HomeContext,
  type HomeSectionSetting,
} from './home'
import { TOOL_PLACEMENTS } from './tool'

const CONTEXTS: HomeContext[] = [{ authenticated: true }, { authenticated: false }]

const ALL_HIDDEN: HomeSectionSetting[] = HOME_SECTIONS.map(entry => ({
  id: entry.id,
  visible: false,
}))

describe('the pinned sections', () => {
  it('need no key, which is what makes an empty home impossible', () => {
    for (const entry of HOME_SECTIONS.filter(candidate => candidate.pinned === true)) {
      expect(entry.requiresApi).toBeUndefined()
    }
  })
})

/**
 * The two registries answer different questions — what the centre stacks, and what the rails
 * hold — and an id in both would be one thing drawn twice, which is exactly what the twelve that
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

    expect(sections).not.toContain('explore')
    expect(sections).toContain('spotlight')
  })

  it('shows every band on a fresh install: what one hides, one hid', () => {
    const sections = visibleHomeSections(DEFAULT_HOME_SECTIONS, { authenticated: true })

    expect(sections).toEqual(HOME_SECTIONS.map(entry => entry.id))
  })

  it('hides a section the user hid, and keeps the pinned one they tried to', () => {
    const sections = visibleHomeSections(ALL_HIDDEN, { authenticated: true })

    expect(sections).toContain('spotlight')
    expect(sections).not.toContain('explore')
  })
})

describe('reading back a stored order', () => {
  it('ignores a section this version no longer knows', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'gone', visible: true },
      { id: 'spotlight', visible: true },
    ]

    // `as` because that id no longer exists in the union — which is the case the guard is for.
    const sections = visibleHomeSections(fromDisk as HomeSectionSetting[], { authenticated: true })

    expect(sections).toContain('spotlight')
    expect(sections).not.toContain('gone')
  })

  /**
   * The settings of anyone who ran the studio before 11 August name twelve bands that are panels
   * now. Nothing migrates them: they are dropped on the way in, which is what keeps a panel from
   * being listed as a band nobody can draw.
   */
  it('drops the ids that became panels, without touching the rest', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'projects', visible: true },
      { id: 'byMode', visible: true },
      { id: 'tools', visible: true },
      { id: 'usage', visible: true },
      { id: 'spotlight', visible: true },
    ]

    const kept = homeSections(fromDisk as HomeSectionSetting[]).map(setting => setting.id)

    expect(kept).not.toContain('projects')
    expect(kept).not.toContain('byMode')
    expect(kept).not.toContain('tools')
    expect(kept).not.toContain('usage')
    expect(kept).toContain('spotlight')
    // The ones it never knew about arrive at their designed place rather than being lost.
    expect(kept).toHaveLength(HOME_SECTIONS.length)
  })

  it('adds a section this version gained, at the place it was designed for', () => {
    const withoutExplore: HomeSectionSetting[] = DEFAULT_HOME_SECTIONS.filter(
      setting => setting.id !== 'explore',
    )

    const sections = visibleHomeSections(withoutExplore, { authenticated: true })

    expect(sections).toEqual(HOME_SECTIONS.map(entry => entry.id))
  })
})

describe('rearranging the home', () => {
  /**
   * Nothing can move today: the centre holds two bands, the first is pinned at the top and the
   * second is anchored to the foot. Both rows of the menu are disabled, and that is the whole
   * point of asking — a row that acts on nothing must say so rather than write an order nobody
   * can see. The rules are kept whole for the day a band comes back to the centre.
   */
  it('refuses a move at either end of the column', () => {
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', 'up')).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', 'down')).toBe(false)
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
    const partial: HomeSectionSetting[] = [{ id: 'explore', visible: true }]

    expect(movedHomeSection(partial, 'explore', 'up')).toHaveLength(HOME_SECTIONS.length)
  })

  it('hides and shows a section, and offers the hidden ones back', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'explore', false)

    expect(hiddenHomeSections(hidden)).toEqual(['explore'])
    expect(hiddenHomeSections(shownHomeSection(hidden, 'explore', true))).toEqual([])
  })

  it('never offers a pinned section back, since it was never taken away', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', false)

    expect(hiddenHomeSections(hidden)).toEqual([])
  })
})

describe('a band that never ends', () => {
  it('is held at the foot of the page whatever the stored order says', () => {
    // Settings written by an earlier version, or by hand, must not land it mid-page.
    const scrambled: HomeSectionSetting[] = [
      { id: 'explore', visible: true },
      { id: 'spotlight', visible: true },
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
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, before?.id ?? 'spotlight', 'down')).toBe(false)
  })

  it('is anchored in the registry, which is what every rule above reads', () => {
    expect(homeSectionOf('explore')?.anchored).toBe(true)
  })
})

/**
 * `shown` narrows a move to the bands actually on screen. Nothing exercises it from the studio
 * today — two bands, one pinned and one anchored — so it is held here on the registry's own
 * shape rather than on a case the home can produce.
 */
describe('moving a band past the ones nobody is shown', () => {
  it('refuses when the only neighbour on that side is not drawn', () => {
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'explore', 'up', ['spotlight'])).toBe(false)
    expect(canMoveHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', 'down', ['explore'])).toBe(false)
  })
})
