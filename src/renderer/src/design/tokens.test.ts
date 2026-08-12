import { describe, expect, it } from 'vitest'
import {
  AA_NON_TEXT,
  AA_NORMAL_TEXT,
  blend,
  contrastRatio,
  HOVER_IS_SEEN,
  hoverFor,
} from '@shared/domain/color'
import { THEME_ATTRIBUTE } from '@shared/domain/settings'
import stylesheet from '../index.css?raw'
import { WRITTEN_SOURCES } from './test-harness'

/**
 * Tailwind 4 builds `text-<name>` from BOTH the font-size scale and the colour tokens, and the
 * colour wins. A token named after a size therefore repaints text instead of sizing it — the
 * `base` token did exactly that, painting titles in the panel background they sat on.
 *
 * Tailwind's own steps, plus the studio ladder read from the stylesheet: the ladder is where a
 * collision would land today, since it is what the studio actually writes.
 */
const BUILT_IN_TEXT_SIZE_NAMES = [
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
]

function themeBlock(): string {
  const [theme = ''] = stylesheet.slice(stylesheet.indexOf('@theme {')).split('\n}')

  return theme
}

function colorTokenNames(): string[] {
  return [...themeBlock().matchAll(/--color-([a-z0-9-]+)\s*:/g)].flatMap(([, name]) => name ?? [])
}

function textSizeNames(): string[] {
  const ladder = [...themeBlock().matchAll(/--text-([a-z0-9-]+)\s*:/g)].flatMap(
    ([, name]) => name ?? [],
  )

  return [...BUILT_IN_TEXT_SIZE_NAMES, ...ladder]
}

/**
 * The trees read `--sc-indent` and no longer spell its factor out, so the factor lives here alone.
 * Written flat, it would need a second declaration under `[data-density]` and would drift from
 * the gutter it is a multiple of — which is exactly how it arrived, as `12` in one file.
 */
describe('the indentation gauge', () => {
  it('derives from the gutter rather than repeating a length', () => {
    expect(stylesheet).toContain('--sc-indent: calc(var(--sc-gutter) * 2);')
  })

  it('is declared once, so density reaches it through the gutter', () => {
    expect(stylesheet.match(/--sc-indent\s*:/g)).toHaveLength(1)
  })
})

describe('color tokens', () => {
  it('are found at all, so the rule below cannot pass on an empty list', () => {
    expect(colorTokenNames()).toContain('panel')
  })

  it('never take a name from a font-size scale', () => {
    const sizes = textSizeNames()

    expect(sizes).toContain('tiny')
    expect(colorTokenNames().filter(name => sizes.includes(name))).toEqual([])
  })
})

/**
 * Read per theme: the light theme restates every token, and an ink that clears its dark
 * background is exactly the wrong colour on the light one. The dark values are the reference and
 * live in `@theme`; the light ones restate them from its own daisyUI block onwards, so reading
 * from each starting point and keeping the FIRST value of each name gives that theme's palette.
 */
function palette(from: number): Record<string, string> {
  const found: Record<string, string> = {}
  for (const [, name = '', value = ''] of stylesheet
    .slice(from)
    .matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    found[name] ??= value
  }

  return found
}

const THEMES = [
  { name: 'dark', from: stylesheet.indexOf('@theme {') },
  { name: 'light', from: stylesheet.indexOf(`name: '${THEME_ATTRIBUTE.light}'`) },
]

/**
 * The three surfaces this rule covers — the ones a word sits on at rest.
 *
 * NOT every surface a word is read on, and the difference is measured: `muted` reads 3.25:1 on
 * `bg-accent-soft` and 3.51 on `bg-elevated` in the dark theme. Raising the token would move the
 * selection colour itself, so those two are answered a row at a time instead — `Row` lifts its
 * subtitle to `text` on exactly those states, and the rule below holds THAT pair.
 */
const READING_SURFACES = ['chassis', 'panel', 'surface']

/**
 * The inks this rule holds. `accent` is absent because it is a fill, see below.
 *
 * The four status hues joined on 2026-08-12, when the palette decision they were waiting on was
 * taken: on the LIGHT theme they read 3.68, 3.27, 3.71 and 2.01 on the chassis — the last below
 * even the 3:1 WCAG 1.4.11 asks of a glyph — and each was moved toward black until it cleared.
 * `create` is held here although it also fills, because two sources write `text-create` — and a
 * green that carries a word at 4.5 carries the rail's white glyph well past the 3:1 of 1.4.11.
 * `create-hover` is NOT: it is the darker state of that fill, and no source writes a word in it.
 */
const INKS = ['text', 'muted', 'accent-ink', 'danger', 'warning', 'success', 'create']

/** `text-muted/70`, `text-base-content/60` — an ink and the opacity it is written at. */
const ALPHA_INK = /\btext-(base-content|muted|text)\/(\d{1,3})\b/g

/**
 * Where each vocabulary is read. daisyUI's `base-*` belongs to the app windows — settings, usage —
 * and the studio's own surfaces to the docks; `CLAUDE.md` draws that boundary and this follows it.
 */
const SURFACES_OF: Record<string, string[]> = {
  'base-content': ['base-100', 'base-200', 'base-300'],
  muted: READING_SURFACES,
  text: READING_SURFACES,
}

/**
 * Two placeholders, exempt and measured: a crossed-out image on an empty thumbnail (1.65:1 at
 * `/30`) and the large glyph of an empty state (1.96 at `/40`).
 *
 * They carry no information a word does not already carry beside them — `EmptyState` renders its
 * sentence in full `muted` right under the glyph, and on a thumbnail the ABSENCE of a picture is
 * itself the message. **Raising them would say the placeholder is the message.**
 *
 * `MediaTile` was on this list and had no business being here: its glyph is `assetIcon(type)`,
 * so it says whether a tile holds a mesh or a sound, and nothing else on the tile does — the
 * caption is the asset's name and the badge is its sync state. It is measured below instead.
 */
const DECORATIVE_GLYPHS = ['/Thumbnail.tsx', '/EmptyState.tsx']

/**
 * A glyph that INFORMS, held at the 3:1 of WCAG 1.4.11 rather than the 4.5 of a word. One site:
 * the type icon a media tile falls back to while its poster is being made.
 */
const INFORMATIVE_GLYPHS = ['/MediaTile.tsx']

/**
 * `opacity-70`, `hover:opacity-90`, and Tailwind's arbitrary `opacity-[0.7]` — a dimming written
 * on an element. The arbitrary form is a FRACTION, so it is read apart: a regex that swallowed
 * both spellings as digits read `[0.7]` as `0` and let it through as a reveal.
 */
const DIMMING = /\bopacity-(?:\[([0-9.]+)(%?)\]|(\d{1,3}))/g

function dimmingPercent(fraction = '', unit = '', step = ''): number {
  if (!fraction) return Number(step)

  return unit ? Number(fraction) : Number(fraction) * 100
}

/**
 * The two sites that dim without a `disabled` beside them, each with the reason it may.
 *
 * Kept as paths rather than folded into the rule because neither is derivable from the text: one
 * dims a picture, the other is a disabled control whose `disabled` prop sits twelve lines above
 * the class. A rule that guessed either would guess wrong on the next site.
 *
 * `ShelfTile` first carried "no word of the tile is inside it", **which was false** — its button
 * wraps a `MediaTile`, whose `figcaption` is a visible word. The reason it may is that the word
 * is white on a near-black gradient and reads about 17:1; a tenth off the whole subtree leaves it
 * nowhere near the bar. The reasons here are prose, and prose is what a reviewer has to check —
 * `staleExemptions` below asks whether an entry is still NEEDED, never whether it is true.
 */
const DIMMING_ALLOWED: Record<string, string> = {
  '/ShelfTile.tsx': 'a caption at ~17:1 on its own gradient, a tenth off it changes nothing',
  '/Counts.tsx': 'a count of nothing, `disabled` on the button twelve lines up',
}

/**
 * A partial opacity, on a source that has not said why.
 *
 * **This is the third angle, and it is the one the two above cannot reach.** `text-muted/70`
 * names its ink, so the sweep can compose it; `opacity-70` names nothing — it dims whatever the
 * element inherits, and what that is lives on an ancestor no text can follow. A file-level guard
 * that tried to read colour through it was written and RETIRED on 2026-08-12, proven to catch
 * none of the five defects it was written for.
 *
 * So this holds the only thing a text can hold, and says so: **no site dims without a reason.**
 * It is what would have caught the price inside the primary button — white at `opacity-70` on
 * the accent, 3.03:1 at rest — which is neither an ink with an alpha nor a token, and which
 * fourteen iterations and two guards walked past.
 *
 * `opacity-0` and `opacity-100` are not dimmings but reveals, and a `disabled` on the same line
 * is WCAG 1.4.3's own exemption: a control that refuses the click owes no ratio.
 *
 * Comments are cut away first, and that is not a detail: this rule flagged its OWN explanation
 * and the one in `styles.ts` on its first run. A guard that reddens when somebody writes down why
 * is a guard that teaches people to stop writing down why.
 *
 * **What it does NOT hold**, so nobody reads it as more than it is: `style={{ opacity: 0.7 }}`
 * writes no class and is invisible to it; `disabled` is looked for on the LINE, so an unrelated
 * `disabled &&` on a long `cn()` call excuses a dimming beside it; and an exemption is by FILE,
 * so a second dimming added to `ShelfTile.tsx` inherits the first one's reason. None of the three
 * has a live case today — the renderer's sixteen `opacity-N` sites were read one by one.
 */
function dimmedWithoutReason(sources: readonly (readonly [string, string])[]): string[] {
  const offenders: string[] = []

  for (const [path, source] of sources) {
    if (Object.keys(DIMMING_ALLOWED).some(one => path.endsWith(one))) continue

    const written = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

    for (const line of written.split('\n')) {
      if (/\bdisabled\b/.test(line)) continue

      for (const [, fraction, unit, step] of line.matchAll(DIMMING)) {
        const percent = dimmingPercent(fraction, unit, step)
        if (percent > 0 && percent < 100) offenders.push(`${path} opacity-${percent}`)
      }
    }
  }

  return offenders
}

/**
 * Every alpha ink of a set of sources, composed on the surfaces of its vocabulary and measured
 * against the bar its role asks for — 4.5 for a word, 3 for a glyph that informs.
 *
 * Taken as a function so the rule can be run against a source known to FAIL, which is what tells
 * a reader it measures anything at all.
 */
function alphaFailures(sources: readonly (readonly [string, string])[]): string[] {
  const failing: string[] = []

  for (const theme of THEMES) {
    const tokens = palette(theme.from)

    for (const [path, source] of sources) {
      if (DECORATIVE_GLYPHS.some(one => path.endsWith(one))) continue
      const bar = INFORMATIVE_GLYPHS.some(one => path.endsWith(one)) ? AA_NON_TEXT : AA_NORMAL_TEXT

      for (const [, ink = '', percent = ''] of source.matchAll(ALPHA_INK)) {
        for (const surface of SURFACES_OF[ink] ?? []) {
          const seen = blend(tokens[ink] ?? '', tokens[surface] ?? '', Number(percent) / 100)
          if (contrastRatio(seen, tokens[surface] ?? '') < bar) {
            failing.push(`${path} ${ink}/${percent} on ${surface}`)
          }
        }
      }
    }
  }

  return failing
}

describe('the contrast of the inks', () => {
  for (const theme of THEMES) {
    it(`clears AA on every surface a word is read on, ${theme.name}`, () => {
      const tokens = palette(theme.from)
      // Both blocks are found and told apart, so neither list below can be silently empty.
      expect(theme.from).toBeGreaterThan(-1)
      expect([...INKS, ...READING_SURFACES].filter(name => !(name in tokens))).toEqual([])

      const failing = INKS.flatMap(ink =>
        READING_SURFACES.filter(
          surface => contrastRatio(tokens[ink] ?? '', tokens[surface] ?? '') < AA_NORMAL_TEXT,
        ).map(surface => `${ink} on ${surface}`),
      )

      expect(failing).toEqual([])
    })
  }

  /**
   * `error` is daisyUI's name for the red the studio calls `danger`, and the two are declared
   * apart — unlike `warning` and `success`, which are one variable serving both. Held equal here
   * rather than measured twice: a settings pane writing `text-error` and a job row writing
   * `text-danger` would otherwise drift into two reds, and only one of them would be covered above.
   */
  it('keeps daisyUI red and the studio red the same colour, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      // Read as a colour first, so two missing names cannot agree with each other.
      expect(tokens.danger).toMatch(/^#[0-9a-f]{6}$/)
      expect(tokens.error).toBe(tokens.danger)
    }
  })

  /**
   * The two fills a list row takes, with the ink that sits on them. `muted` is NOT held here and
   * that is the whole point of the pair: it reads 3.25:1 on `accent-soft` and 3.51 on `elevated`
   * in the dark theme, so `Row` lifts its subtitle to `text` on exactly these two states rather
   * than the palette moving under every list in the studio.
   */
  it('carries the full ink on the two backgrounds a row takes, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      const failing = ['accent-soft', 'elevated'].filter(
        fill => contrastRatio(tokens.text ?? '', tokens[fill] ?? '') < AA_NORMAL_TEXT,
      )

      expect(failing).toEqual([])
    }
  })

  /**
   * The one ink in the studio that is darker than its fill on one theme and lighter on the other.
   * Held at AA rather than at the 3:1 of WCAG 1.4.11 that a glyph would need: the rail's plus is
   * a glyph today, and a token that only ever cleared the glyph bar would be the wrong thing to
   * hand the first label somebody writes on that button.
   */
  it('carries an ink the create button can be drawn in, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      expect(tokens['create-content']).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrastRatio(tokens['create-content'] ?? '', tokens.create ?? '')).toBeGreaterThan(
        AA_NORMAL_TEXT,
      )
    }
  })

  /**
   * The ink written ON the accent, which the sheet ships and `useAppearance` recomputes for a
   * picked one. Held here because the sheet's own answer has to be right too: the accent was
   * darkened to #336fe6 on 2026-08-12 for exactly this pair, white on it going 4.28 → 4.61.
   */
  it('carries an ink the accent can be written on, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      expect(tokens['accent-content']).toMatch(/^#[0-9a-f]{6}$/)
      expect(
        contrastRatio(tokens['accent-content'] ?? '', tokens.accent ?? ''),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
    }
  })

  /**
   * The same ink under the POINTER, which was nobody's question and is where it failed. The
   * primary button hovered at `bg-accent/85` — an alpha, so the surface showed through: it
   * darkened the blue on a dark panel and LIGHTENED it on a light one, taking the white label to
   * 3.52:1. A state a word cannot be read in is not a hover, and no ratio of this file saw it,
   * because every one of them measured a token and this colour was composed at paint time.
   *
   * The token is held to `hoverFor` rather than to a number: the sheet ships one accent and the
   * user may pick another, so a hand-written hex here would be right for exactly one of them.
   */
  it('carries a hover the accent keeps its ink on, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)
      const accent = tokens.accent ?? ''
      const hover = tokens['accent-hover'] ?? ''

      expect(hover).toBe(hoverFor(accent))
      expect(contrastRatio(tokens['accent-content'] ?? '', hover)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT,
      )
      // And it is a hover at all — the fill has to move, or pointing at the button says nothing.
      expect(contrastRatio(accent, hover)).toBeGreaterThanOrEqual(HOVER_IS_SEEN)
    }
  })

  /**
   * The `create` pair the sheet writes BY HAND, held against the same function. It is what says
   * the step of `hoverFor` is the studio's own rather than a number fitted to the accent: a human
   * drew this green's hover by eye, in both themes, and the function lands on it to the byte.
   *
   * Read from the stylesheet and not recopied here, which is the difference between holding the
   * claim and restating it: the day the green moves, this is what says whether it still holds.
   */
  it('redraws the one hover pair a human picked, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      expect(tokens['create-hover']).toBe(hoverFor(tokens.create ?? ''))
    }
  })

  /**
   * An alpha of the accent lets the surface through, and that is the whole defect above. Every
   * state, not just `hover:` — `active:bg-accent/85` on a primary toggle replays it exactly.
   */
  it('leaves no source taking a state of the accent through an alpha', () => {
    const throughAnAlpha = /\b(hover|active|focus|focus-visible|group-hover)[^\s'"]*:bg-accent\/\d/

    const offenders = WRITTEN_SOURCES.filter(([, source]) => throughAnAlpha.test(source)).map(
      ([path]) => path,
    )

    expect(offenders).toEqual([])
    // The rule refuses something, which a sweep that only ever returns nothing cannot show.
    expect(throughAnAlpha.test("'hover:bg-accent/85'")).toBe(true)
    expect(throughAnAlpha.test("'active:bg-accent/85'")).toBe(true)
    expect(throughAnAlpha.test("'hover:bg-accent-hover'")).toBe(false)
  })

  /**
   * The accent as a CONTROL against the surfaces it is drawn over — the focus ring, first of
   * all, which `FOCUS_RING` paints in this very colour and which is the only thing saying where
   * the keyboard is. WCAG 1.4.11 asks 3:1 of it, and that is the second bar the accent is pinned
   * between: white on it needs the blue dark, the ring needs it light.
   *
   * **Written because the pair went unmeasured and broke.** On 2026-08-12 the accent was darkened
   * to #336fe6 for the ink alone, taking the ring to 2.997 — under the bar, and recorded in a
   * comment as "3.00, exactly the 3:1", because two decimals hid the crossing. A ratio that a
   * human rounds is a ratio no one is holding.
   */
  it('stays visible as a control on every surface it is drawn over, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      const failing = READING_SURFACES.filter(
        surface => contrastRatio(tokens.accent ?? '', tokens[surface] ?? '') < AA_NON_TEXT,
      )

      expect(failing).toEqual([])
    }
  })

  /**
   * A white written outright cannot follow a picked accent: on a yellow one it reads 1.71:1, and
   * the token exists so that it does follow. `MediaTile` is the one exemption and it is not an
   * accent case — its caption sits on a PICTURE, contrasted by the gradient beneath it.
   */
  it('leaves no white written by hand where a token would follow the accent', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => !path.endsWith('/MediaTile.tsx') && /\btext-white(?![\w-])/.test(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  /**
   * The inks written with an ALPHA, composed on their fill before being measured — the only way
   * to see them at all. `text-muted/70` is not a colour, it is an instruction, and a ratio taken
   * on `muted` alone answers 5.79 where the reader sees 3.50.
   *
   * **This is the angle every guard of this repository was blind to until 2026-08-12**, and it
   * held two real defects: `WINDOW_CAPTION` at `/60` read 3.86:1 on a light `base-300`, and a
   * journal detail at `text-muted/70` failed in BOTH themes. Fourteen iterations measured opaque
   * tokens and found neither.
   *
   * Each vocabulary is composed on its own surfaces: daisyUI's `base-content` belongs to the app
   * windows, the studio's inks to the docks — the boundary `CLAUDE.md` draws.
   */
  it('clears its bar once composed, wherever an ink is written with an alpha', () => {
    expect(alphaFailures(WRITTEN_SOURCES)).toEqual([])
  })

  /**
   * The sweep run against a source that is KNOWN bad — the exact state `window-styles.ts` was in
   * before this batch. Without it, five one-line edits leave the rule green while it measures
   * nothing: `alpha = 1`, an emptied `SURFACES_OF`, the threshold lowered to the glyph bar, a path
   * added to the exemptions. A rule that cannot be shown to refuse anything refuses nothing.
   */
  it('refuses an ink that fails, which is the only way to know it measures at all', () => {
    const bad = alphaFailures([['./probe.ts', "'text-base-content/60 text-xs'"]])

    expect(bad).toContain('./probe.ts base-content/60 on base-300')
    // And the same ink one step up passes, so the probe proves the threshold, not the sweep.
    expect(alphaFailures([['./probe.ts', "'text-base-content/70'"]])).toEqual([])
  })

  it('leaves no word dimmed by an opacity nobody has justified', () => {
    expect(dimmedWithoutReason(WRITTEN_SOURCES)).toEqual([])
  })

  it('refuses a dimming that says nothing, and takes the two that do', () => {
    // The exact line this batch removed, and the reason the sweep above could not see it.
    expect(
      dimmedWithoutReason([['./probe.tsx', "<span className='text-tiny opacity-70'>"]]),
    ).toEqual(['./probe.tsx opacity-70'])
    expect(dimmedWithoutReason([['./probe.tsx', "disabled && 'opacity-40'"]])).toEqual([])
    // And a comment that NAMES a dimming is not one — the rule flagged its own prose at first.
    expect(dimmedWithoutReason([['./probe.tsx', '/* an `opacity-70` read 3.03:1 */']])).toEqual([])
    expect(dimmedWithoutReason([['./probe.tsx', '// opacity-70 was here']])).toEqual([])
    expect(dimmedWithoutReason([['./probe.tsx', "'opacity-0 group-hover:opacity-100'"]])).toEqual(
      [],
    )
    // Tailwind's arbitrary form, which the first spelling of this rule read as `0` and let past.
    expect(dimmedWithoutReason([['./probe.tsx', "'opacity-[0.7]'"]])).toEqual([
      './probe.tsx opacity-70',
    ])
    expect(dimmedWithoutReason([['./probe.tsx', "'opacity-[70%]'"]])).toEqual([
      './probe.tsx opacity-70',
    ])
  })

  /**
   * The exemptions, held to still be needed. An entry outliving the dimming it excused is how a
   * list like this rots into a hole — `stores/no-bare-shared-word-export.test.ts` learnt it on
   * 2026-08-12, when two names were closed only because their exemption started failing.
   */
  it('carries no exemption for a site that has stopped dimming', () => {
    const stale = Object.keys(DIMMING_ALLOWED).filter(
      one =>
        !WRITTEN_SOURCES.some(
          ([path, source]) => path.endsWith(one) && dimmedWithoutReason([['probe', source]]).length,
        ),
    )

    expect(stale).toEqual([])
    // The reasons are read by a human and by nothing else, so at least require they exist.
    expect(Object.values(DIMMING_ALLOWED).filter(one => one.length < 20)).toEqual([])
  })

  /**
   * The same question asked of the two glyph lists above, which had no such guard and needed one:
   * `DECORATIVE_GLYPHS` has already rotted once — its own comment tells how `MediaTile` sat on it
   * with no business being there, and nothing reddened. An exemption is a claim about a site, and
   * a claim nobody rechecks is how a hole comes to look like a decision.
   */
  it('carries no glyph exemption for a source that has stopped writing an alpha', () => {
    const stale = [...DECORATIVE_GLYPHS, ...INFORMATIVE_GLYPHS].filter(
      one =>
        !WRITTEN_SOURCES.some(([path, source]) => path.endsWith(one) && source.match(ALPHA_INK)),
    )

    expect(stale).toEqual([])
  })

  it('finds an alpha ink at all, so the rule above cannot pass on an empty sweep', () => {
    // `String.match` and not `RegExp.test`: a global regex carries `lastIndex` from one file to
    // the next, and this count read 9 of the 11 that exist before it was written this way.
    const written = WRITTEN_SOURCES.filter(([, source]) => source.match(ALPHA_INK))

    expect(written.length).toBeGreaterThanOrEqual(10)
  })

  /**
   * `accent` is the FILL — a button's background, the playhead, a ring. Lightening it to clear
   * the threshold as ink would take white on it from 4.28 to 3.01, so the two parted ways; a
   * source that writes `text-accent` has picked the one that cannot carry a word.
   */
  it('keeps the fill out of the sources that paint words', () => {
    const offenders = WRITTEN_SOURCES.filter(([, source]) =>
      /\btext-accent(?![\w-])/.test(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })
})
