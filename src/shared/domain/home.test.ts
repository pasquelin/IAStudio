import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTIONS,
  homeSections,
  hiddenHomeSections,
  homeSectionOf,
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
   *
   * Eleven of the twelve, since 12 August: `tools` came back to the centre, so a stored line
   * naming it is a band again — which is the other half of the same rule, and the reason this
   * reads the registry rather than a list written here.
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
    expect(kept).not.toContain('usage')
    expect(kept).toContain('tools')
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

describe('hiding a band', () => {
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

  it('is anchored in the registry, which is what that rule reads', () => {
    expect(homeSectionOf('explore')?.anchored).toBe(true)
  })
})
