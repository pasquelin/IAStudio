import { describe, expect, it } from 'vitest'
import {
  BUTTON_NEUTRAL,
  FOCUS_RING,
  OVERLAY_BUTTON,
  ROW_INK,
  ROW_QUIET,
  rowSkin,
  TILE_QUIET,
  TITLE_BAR_GHOST,
} from './styles'
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
  it('lifts on the state the skin knows, and stays quiet at rest', () => {
    expect(ROW_QUIET).toContain('text-muted')
    expect(ROW_QUIET).toContain('group-data-selected/row:text-text')
    // The fill fades under it; the property does not inherit, so the word carries its own.
    expect(ROW_QUIET).toContain('transition-colors')
  })

  /**
   * The lift for `elevated` at 3.51:1 left with the fill that made it necessary: no list in the
   * studio takes one under the pointer any more. A word that brightens over a background standing
   * perfectly still is the hover this batch went to remove, arriving by the back door.
   */
  it('no longer brightens under a pointer, since no list fills under one', () => {
    expect(ROW_QUIET).not.toContain('group-hover/row')
  })

  /**
   * Five sites had reached these three classes on their own, one of them twice — and a sixth was
   * about to. Read off the constant rather than spelled out again, so a change of rule moves
   * every word with it. Three wear it today: two of the six went with the home's panels on
   * 13 August, and the floor below moved with them rather than being left to pass on a studio
   * that had lost half its wearers.
   *
   * **What this holds is narrow, and the narrowness matters**: it refuses the literal re-copy of
   * this one class, nothing else. A site that writes `text-muted` ALONE under a row — the very
   * state `AssetRow` was in before this batch — passes it untouched, and so would a variant
   * (`group-hover/row:text-accent-content`) or a group under another name. What catches those is
   * a test at the site, and each of the three sites has one.
   *
   * `WRITTEN_SOURCES` reads `renderer/src` only: a class string written in `shared/` would not be
   * seen. No JSX lives there today, which is why the gap is tolerated rather than closed.
   *
   * **What it now watches is the hover lift, which the constant no longer carries.** A word only
   * has to brighten under the pointer where the background under it moves, and one surface in the
   * studio is left in that case — a TILE, whose fill is the whole of what says it can be pressed.
   * A list arriving here is a list that has quietly taken its hover back.
   */
  it('lifts under a pointer only through the constant that carries the case', () => {
    const lifting = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('group-hover/row:text-text'),
    ).map(([path]) => path)

    expect(lifting).toEqual([])
  })

  /**
   * The one case left where a word DOES have to brighten under the pointer: a tile, whose fill is
   * the whole of what says it can be pressed. `muted` reads 3.51:1 on `elevated`, so the lift is
   * not a flourish — it is what clears WCAG 1.4.3 exactly where that fill arrives.
   *
   * A constant rather than the variant at each site, because the rule above can then go on
   * REFUSING rather than becoming a list of filenames allowed to break it.
   */
  it('gives a tile its own constant, since a tile is what still fills', () => {
    expect(TILE_QUIET).toContain('group-hover/row:text-text')
    expect(TILE_QUIET).toContain(ROW_QUIET)
  })

  // The partner of the rule above: it stays green on a studio where nobody wears the constant at
  // all, which is what a dead export looks like from here.
  it('is worn by the sites it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('ROW_QUIET'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(3)
  })
})

describe('the row skin and the state it publishes', () => {
  it('opens a named group, which is what a subtitle reads its state from', () => {
    expect(rowSkin(false)).toContain('group/row')
    expect(rowSkin(true)).toContain('group/row')
  })

  it('takes the group away from a refused row, whose background does not answer either', () => {
    expect(rowSkin(false, { disabled: true })).not.toContain('group/row')
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

  /**
   * The two surfaces of the studio that fill under the pointer, named rather than counted.
   *
   * A `tile` is the one thing `rowSkin` fills for, and it is asked for by name — so who may ask
   * is the rule. Both of these are tiles in the strict sense: nothing else about them looks like
   * a control, so the fill is the whole of what says they can be pressed.
   *
   * The inspector is deliberately absent, and that is a decision of 2026-08-14: no line of it
   * answers the pointer. The cost was stated when it was taken — nothing distinguishes a line one
   * can open from a line one only reads, and what says a row opens is its tooltip.
   */
  const MAY_FILL_UNDER_THE_POINTER = [
    '../home/sections/Tools.tsx',
    '../panels/channels/ChannelTile.tsx',
  ]

  /**
   * Repo-wide rather than by folder, and that is the point: a row of the inspector drawn from
   * `design/` — a texture slot is one — sits outside every folder rule anyone would write.
   *
   * **What this does NOT hold**: a `hover:bg-` written by hand, on a line that never goes through
   * `rowSkin`. The studio's fill is guarded here because the studio's fill has one door; a panel
   * painting its own is caught by nothing.
   */
  it('fills under the pointer for two surfaces only, and neither is a line of the inspector', () => {
    const asking = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes("surface: 'tile'"),
    ).map(([path]) => path)

    expect(asking.sort()).toEqual([...MAY_FILL_UNDER_THE_POINTER].sort())
  })

  /**
   * The exemption above lets `styles.ts` say anything, and one of its constants is worn by every
   * line the rule protects: `OVERLAY_BUTTON` covers a texture slot, a model's material, a channel
   * tile and a shelf tile. A fill added there would repaint the whole inspector at once and leave
   * the rule green, since the rule never reads this file.
   */
  it('keeps the fill out of the button laid over a line, which no rule above can see', () => {
    expect(OVERLAY_BUTTON).not.toMatch(/hover:bg-/)
  })
})

/**
 * The loud fill, for the one list whose selection says WHERE ONE IS rather than what a gesture
 * gathered. Every assertion here is a measurement, not a taste: `--color-accent` is pinned at
 * 4.508:1 against pure white, so on that fill nothing but `accent-content` clears WCAG 1.4.3 —
 * `text` reads 3.44 — and `FOCUS_RING` draws in `accent`, which on an accent fill is 1:1.
 *
 * `design/tokens.test.ts` owns the ratios themselves; what this file owns is that the skin and the
 * two inks actually ASK for them.
 */
describe('the loud fill of a row that says where one is', () => {
  it('fills with the accent itself, where the soft tone fills with its muted twin', () => {
    expect(rowSkin(true, { tone: 'strong' })).toContain('bg-accent')
    expect(rowSkin(true, { tone: 'strong' })).not.toContain('bg-accent-soft')
    expect(rowSkin(true, { tone: 'soft' })).toContain('bg-accent-soft')
  })

  // Soft is the default, so no existing caller can be repainted by this landing.
  it('is not what a caller gets without asking', () => {
    expect(rowSkin(true)).toBe(rowSkin(true, { tone: 'soft' }))
  })

  /**
   * The ring would otherwise be `accent` on `accent` — 1:1, and therefore no focus indicator at
   * all on the single row where a keyboard most needs one. Overridden last so `cn` keeps it.
   */
  it('takes the ring off the accent it would otherwise be invisible against', () => {
    expect(rowSkin(true, { tone: 'strong' })).toContain('focus-visible:ring-accent-content')
    expect(rowSkin(true, { tone: 'strong' })).not.toContain('focus-visible:ring-accent ')
    expect(rowSkin(true, { tone: 'soft' })).toContain('focus-visible:ring-accent')
  })

  // Only a SELECTED row is filled, so an unselected one must keep the ordinary ring and hover.
  it('changes nothing about a row that is not the one open', () => {
    expect(rowSkin(false, { tone: 'strong' })).toBe(rowSkin(false, { tone: 'soft' }))
  })

  /**
   * Both inks, and it has to be both: the colour can no longer separate a name from its subtitle
   * on that fill, so the size does — which is only true if neither is left behind at 3.44:1.
   */
  it('takes both the name and its subtitle to the ink the accent needs', () => {
    for (const ink of [ROW_INK, ROW_QUIET]) {
      expect(ink).toContain('group-data-accented/row:text-accent-content')
    }
    // At rest they are still what they always were — the variant only fires under the attribute.
    expect(ROW_INK).toContain('text-text')
    expect(ROW_QUIET).toContain('text-muted')
  })

  /**
   * The subtitle needs a SECOND spelling, and this is the whole of why: it also carries a
   * `data-selected` lift to `text`, the two variants compile to the same specificity, and Tailwind
   * emits the accented one FIRST — so `text` won and the path under the open project's name
   * rendered at 3.44:1. Being written last in the class string decides nothing; the cascade never
   * reads attribute order. Stacking the variants takes the accented rule to (0,3,0).
   *
   * What this can and cannot see: jsdom applies no stylesheet, so no suite here resolves a
   * cascade. Asserted is the SHAPE that outranks the lift — the ratio itself was measured in
   * Electron, and `ROW_INK` needs none of this since its base `text-text` is (0,1,0).
   */
  it('outranks its own selected lift rather than trusting the order it is written in', () => {
    expect(ROW_QUIET).toContain('group-data-selected/row:text-text')
    expect(ROW_QUIET).toContain(
      'group-data-accented/row:group-data-selected/row:text-accent-content',
    )
  })

  /**
   * A control INSIDE such a row — the rename field, its menu button — draws the studio's one focus
   * ring, and that ring is the accent: on an accent fill it is 1:1, so a keyboard sees nothing at
   * all (WCAG 2.4.7). Fixed on the indicator rather than at each caller, since "must not draw in
   * accent over an accent fill" is a property of the ring.
   */
  it('takes the ring of a control standing inside such a row off the accent too', () => {
    expect(FOCUS_RING).toContain('group-data-accented/row:focus-visible:ring-accent-content')
  })

  /**
   * The partner of the rule above, and the failure it guards is silent: the skin paints the accent
   * while the words stay at 3.44:1, with nothing on screen saying so. `data-selected` alone cannot
   * drive it — every picked row in the studio carries that one.
   */
  /**
   * Whoever PAINTS the tone, not whoever asks for it: a panel writes `selectionTone="strong"` and
   * leaves the attribute to the surface that draws the cell, which is the only place that can
   * emit it. Filtering on the word alone caught the panel and let the painter through — and it
   * caught nothing at all before that, since it looked for `'strong'` in single quotes while the
   * one site that asks writes it as a JSX attribute.
   */
  it('is never painted without the attribute the two inks read', () => {
    const painters = WRITTEN_SOURCES.filter(
      ([path, source]) =>
        path !== GUARDED && /\browSkin\(/.test(source) && /["']strong["']/.test(source),
    )

    expect(painters.map(([path]) => path)).not.toEqual([])
    expect(painters.filter(([, source]) => !source.includes('data-accented'))).toEqual([])
  })
})

/**
 * The fill a button of the docks takes when it is not the primary action. Two sites reached it on
 * their own — `Button`'s neutral variant and the idea card of `Spark` — and the second had written
 * beside itself that it was avoiding a copy while writing one. `Spark` went with the home's panels
 * on 13 August, so `Button` is the one wearer left; the constant is kept because the rule below is
 * what stops the second site from being written again.
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
  it('is worn by the site it was extracted for', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('BUTTON_NEUTRAL'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(1)
  })
})
