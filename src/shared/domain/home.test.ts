import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTIONS,
  homeSections,
  hiddenHomeSections,
  shownHomeSection,
  visibleHomeSections,
  type HomeSectionSetting,
} from './home'
import { TOOL_PLACEMENTS } from './tool'

const ALL_HIDDEN: HomeSectionSetting[] = HOME_SECTIONS.map(entry => ({
  id: entry.id,
  visible: false,
}))

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
  it('is never empty, whatever the user hid and whether or not a key is connected', () => {
    for (const stored of [DEFAULT_HOME_SECTIONS, ALL_HIDDEN, []]) {
      for (const hasApi of [true, false]) {
        expect(visibleHomeSections(stored, hasApi).length).toBeGreaterThan(0)
      }
    }
  })

  it('shows every band on a fresh install: what one hides, one hid', () => {
    expect(visibleHomeSections(DEFAULT_HOME_SECTIONS, true)).toEqual(
      HOME_SECTIONS.map(entry => entry.id),
    )
  })

  it('hides a section the user hid, and keeps the pinned one they tried to', () => {
    const sections = visibleHomeSections(ALL_HIDDEN, true)

    expect(sections).toContain('spotlight')
    expect(sections).not.toContain('models')
  })

  /**
   * The band that replaced the explore feed is the one the studio has most to say about when no
   * key has ever been entered — an empty machine is a reading, not an absence.
   */
  it('draws the models band with nothing configured at all', () => {
    expect(visibleHomeSections([], false)).toContain('models')
  })

  /**
   * The other half of that reading: a band about what is moving OUTSIDE the studio has nothing to
   * fill itself with on a machine that talks to nobody, and an apology under a heading is worse
   * than the room it takes.
   */
  it('leaves out a band that needs the cloud when there is no account for it', () => {
    expect(visibleHomeSections(DEFAULT_HOME_SECTIONS, false)).not.toContain('news')
    expect(visibleHomeSections(DEFAULT_HOME_SECTIONS, true)).toContain('news')
  })
})

describe('reading back a stored order', () => {
  it('ignores a section this version no longer knows', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'gone', visible: true },
      { id: 'spotlight', visible: true },
    ]

    // `as` because that id no longer exists in the union — which is the case the guard is for.
    const sections = visibleHomeSections(fromDisk as HomeSectionSetting[], true)

    expect(sections).toContain('spotlight')
    expect(sections).not.toContain('gone')
  })

  /**
   * The settings of anyone who ran the studio before 11 August name twelve bands that are panels
   * now, and anyone who ran it before this lot names `explore`. Nothing migrates either: they are
   * dropped on the way in, which is what keeps an id nobody can draw from being listed as a band.
   *
   * Eleven of the twelve, since 12 August: `tools` came back to the centre, so a stored line
   * naming it is a band again — which is the other half of the same rule, and the reason this
   * reads the registry rather than a list written here.
   */
  it('drops the ids that became panels or went away, without touching the rest', () => {
    const fromDisk: { id: string; visible: boolean }[] = [
      { id: 'projects', visible: true },
      { id: 'explore', visible: true },
      { id: 'tools', visible: true },
      { id: 'usage', visible: true },
      { id: 'spotlight', visible: true },
    ]

    const kept = homeSections(fromDisk as HomeSectionSetting[]).map(setting => setting.id)

    expect(kept).not.toContain('projects')
    expect(kept).not.toContain('explore')
    expect(kept).not.toContain('usage')
    expect(kept).toContain('tools')
    expect(kept).toContain('spotlight')
    // The ones it never knew about arrive at their designed place rather than being lost.
    expect(kept).toHaveLength(HOME_SECTIONS.length)
  })

  it('adds a section this version gained, at the place it was designed for', () => {
    const withoutModels: HomeSectionSetting[] = DEFAULT_HOME_SECTIONS.filter(
      setting => setting.id !== 'models',
    )

    expect(visibleHomeSections(withoutModels, true)).toEqual(HOME_SECTIONS.map(entry => entry.id))
  })
})

describe('hiding a band', () => {
  it('hides and shows a section, and offers the hidden ones back', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'models', false)

    expect(hiddenHomeSections(hidden, true)).toEqual(['models'])
    expect(hiddenHomeSections(shownHomeSection(hidden, 'models', true), true)).toEqual([])
  })

  /** Offering back a band this studio cannot draw is a line that does nothing when clicked. */
  it('never offers back a band the cloud account is missing for', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'news', false)

    expect(hiddenHomeSections(hidden, false)).toEqual([])
    expect(hiddenHomeSections(hidden, true)).toEqual(['news'])
  })

  it('never offers a pinned section back, since it was never taken away', () => {
    const hidden = shownHomeSection(DEFAULT_HOME_SECTIONS, 'spotlight', false)

    expect(hiddenHomeSections(hidden, true)).toEqual([])
  })
})
