import { describe, expect, it } from 'vitest'
import { BUTTON_NEUTRAL, ROW_QUIET, rowSkin, TITLE_BAR_GHOST } from './styles'
import { WRITTEN_SOURCES } from './test-harness'

/**
 * Read off the skin rather than spelled out again, so a change of shade moves the rule with it.
 * Only the background: `hover:text-text` is worn all over the studio and says nothing about which
 * bar one is in, whereas the half-opaque fill belongs to this one.
 */
const OWN_HOVER = TITLE_BAR_GHOST.split(' ').filter(one => one.startsWith('hover:bg-'))

/** As `WRITTEN_SOURCES` keys it: the glob resolves against `test-harness.ts`, its own neighbour. */
const GUARDED = './styles.ts'

describe('the shared class strings', () => {
  it('finds the sources and the shade at all, so the rule below cannot pass on empty lists', () => {
    expect(WRITTEN_SOURCES.length).toBeGreaterThan(100)
    expect(OWN_HOVER).not.toEqual([])
    expect(WRITTEN_SOURCES.map(([path]) => path)).toContain(GUARDED)
  })

  it('keeps the title bar hover in one place', () => {
    // This module alone, matched whole: `home/styles.ts` and `stores/styles.ts` both end in
    // `/styles.ts`, and letting them off would leave the copy this rule exists to catch a home.
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && OWN_HOVER.some(one => source.includes(one)),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })
})

describe('the quiet ink of a row', () => {
  it('lifts on both states the skin knows, and stays quiet at rest', () => {
    expect(ROW_QUIET).toContain('text-muted')
    expect(ROW_QUIET).toContain('group-hover/row:text-text')
    expect(ROW_QUIET).toContain('group-data-selected/row:text-text')
    // The fill fades under it; the property does not inherit, so the word carries its own.
    expect(ROW_QUIET).toContain('transition-colors')
  })

  /**
   * Five sites had reached these three classes on their own, one of them twice — and a sixth was
   * about to. Read off the constant rather than spelled out again, so a change of rule moves
   * every word with it.
   *
   * **What this holds is narrow, and the narrowness matters**: it refuses the literal re-copy of
   * this one class, nothing else. A site that writes `text-muted` ALONE under a row — the very
   * state `AssetRow` was in before this batch — passes it untouched, and so would a variant
   * (`group-hover/row:text-accent-content`) or a group under another name. What catches those is
   * a test at the site, and each of the six sites has one.
   *
   * `WRITTEN_SOURCES` reads `renderer/src` only: a class string written in `shared/` would not be
   * seen. No JSX lives there today, which is why the gap is tolerated rather than closed.
   */
  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('group-hover/row:text-text'),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  // The partner of the rule above: it stays green on a studio where nobody wears the constant at
  // all, which is what a dead export looks like from here.
  it('is worn by the sites it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('ROW_QUIET'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(4)
  })
})

describe('the row skin and the state it publishes', () => {
  it('opens a named group, which is what a subtitle reads its state from', () => {
    expect(rowSkin(false)).toContain('group/row')
    expect(rowSkin(true)).toContain('group/row')
  })

  it('takes the group away from a refused row, whose background does not answer either', () => {
    expect(rowSkin(false, true)).not.toContain('group/row')
  })

  /**
   * The skin says HOW a picked row looks; `data-selected` says THAT it is picked, and only the
   * caller can put an attribute on the element. A site that takes the first without the second
   * paints the background and leaves the row's words at 3.25:1 — with nothing on screen to say so.
   *
   * `rowSkin(false)` is exempt: a list with no selection has no state to publish.
   *
   * **What this does NOT hold**: the attribute has to sit on the element that wears the skin, and
   * this rule only asks that the file mention it somewhere. A site that puts `data-selected` on a
   * child leaves those words at 3.25:1 with the guard still green — the selector is
   * `.group/row[data-selected]`, one element, not a subtree.
   */
  it('is never worn without the attribute that drives it', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) =>
        path !== GUARDED &&
        // `false` closed OR followed by a `disabled` argument: what the exemption turns on is the
        // FIRST argument, and a line that can be refused still has no selection to publish.
        /\browSkin\((?!false[,)])/.test(source) &&
        !source.includes('data-selected'),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('finds the callers at all, so the rule above cannot pass on an empty list', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\browSkin\(/.test(source),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(4)
  })
})

/**
 * The fill a button of the docks takes when it is not the primary action. Two sites reached it on
 * their own — `Button`'s neutral variant and the idea card of `Spark` — and the second had written
 * beside itself that it was avoiding a copy while writing one.
 */
const REWRITTEN = /(bg-surface[^'"`]*hover:bg-elevated|hover:bg-elevated[^'"`]*bg-surface)/

describe('the neutral fill of a button', () => {
  it('carries the fill, the ink on it, and what the pointer does', () => {
    expect(BUTTON_NEUTRAL).toContain('bg-surface')
    expect(BUTTON_NEUTRAL).toContain('text-text')
    expect(BUTTON_NEUTRAL).toContain('hover:bg-elevated')
  })

  /**
   * Narrow on purpose, like its neighbour above: it refuses the re-copy of the FILL and its hover
   * inside ONE class string, either way round. A site writing `hover:bg-elevated` over some other
   * fill is a different question — `ToolButton` sits on `bg-transparent`, the carousel arrow on a
   * shadow — and this rule deliberately leaves them alone.
   *
   * **What it cannot see, and why widening it would be wrong**: the pair reached across two
   * strings of one `cn()`, or through a helper. Reading the whole FILE instead would flag
   * `home/sections/Tools.tsx`, where `bg-surface` fills the section and `rowSkin` hovers the tiles
   * INSIDE it — two elements, not one. A guard by file cannot tell which element carries what,
   * which is the lesson a rule written and retired on 2026-08-12 already cost.
   */
  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && REWRITTEN.test(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('refuses the re-copy either way round, which is the only way to know it refuses anything', () => {
    // The exact string both sites carried before this batch, and the same one reordered — which
    // prettier is free to do, and which the first spelling of this rule walked straight past.
    expect(REWRITTEN.test("'bg-surface hover:bg-elevated flex'")).toBe(true)
    expect(REWRITTEN.test("'hover:bg-elevated hover:text-text bg-surface'")).toBe(true)
    expect(REWRITTEN.test("'bg-transparent hover:bg-elevated'")).toBe(false)
  })

  // The partner of the rule above: it stays green on a studio where nobody wears the constant,
  // which is what a dead export looks like from here.
  it('is worn by the two sites it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('BUTTON_NEUTRAL'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(2)
  })
})
