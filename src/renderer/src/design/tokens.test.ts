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

/**
 * The bubble and its measure are joined by a string and nothing else: rename the gauge and
 * `var(--sc-tooltip)` substitutes nothing, `max-width` falls back to `none`, and react-tooltip's
 * own `width: max-content` puts the bubble back across the canvas — with the whole suite green.
 *
 * In `ch` for the reason written beside it: the bubble wears `--text-tiny`, which follows
 * `appearance.fontScale`, so a length in pixels would narrow the prose for whoever enlarged it.
 */
describe('the tooltip measure', () => {
  it('is a gauge the host actually reads', () => {
    const host = WRITTEN_SOURCES.find(([path]) => path.endsWith('/TooltipHost.tsx'))

    expect(stylesheet).toMatch(/--sc-tooltip:\s*\d+ch;/)
    expect(host?.[1]).toContain('max-w-(--sc-tooltip)')
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

/**
 * Where each token is read — **the single table both rules below derive from**, so a token cannot
 * be captured without a background to compose it on, nor given one nothing captures.
 *
 * It was two lists that had to be edited together, which `CLAUDE.md` documented as a trap rather
 * than closing: completing one without the other left the sweep green in silence. Deriving the
 * spellings from the keys makes that impossible to write.
 *
 * The vocabulary decides the background, and that is the design-system boundary: daisyUI's
 * `base-*` belongs to the app windows — settings, usage — and the studio's own tokens to the docks.
 *
 * `accent` is here for the FILL rule and only reachable by it: it is the one token that is a fill
 * rather than an ink, so no source may write it as a word — a separate rule refuses `text-accent`
 * outright — but `bg-accent/30` would be a shape like any other.
 */
const SURFACES_OF: Record<string, string[]> = {
  'base-content': ['base-100', 'base-200', 'base-300'],
  ...Object.fromEntries([...INKS, 'accent'].map(ink => [ink, READING_SURFACES])),
}

const VOCABULARY = Object.keys(SURFACES_OF).join('|')

/**
 * `text-muted/70`, `fill-base-content/60` — a token painting a WORD, at an opacity.
 *
 * `fill-` and `stroke-` are here because SVG paints its text with them, and that is not a
 * hypothetical: a chart's graduations were written `fill-base-content/60` and read **3.86:1** on a
 * light `base-300`. Two guards walked past them for reading `text-` alone.
 */
const ALPHA_INK = new RegExp(String.raw`\b(?:text|fill|stroke)-(${VOCABULARY})\/(\d{1,3})\b`, 'g')

/**
 * `bg-muted/40`, `border-create/40` — a token drawing a SHAPE, at an opacity.
 *
 * A separate family, and not the sweep above wearing another hat: that one asks what a WORD reads
 * at, this one what a SHAPE reads at, and they answer to different lines of WCAG. The carousel's
 * unread pagination dots were `bg-muted/40` and stood at 1.99:1 on a panel — a control saying how
 * many pages there are, and how many of them you can see.
 *
 * The vocabulary is the table's, deliberately: `bg-panel/80` and `bg-chassis/75` are SCRIMS — a
 * surface token spent as a translucent surface, which is what a scrim is — and holding them to a
 * contrast bar would be measuring the wrong thing entirely. `from-black/85` names no token at all.
 */
const ALPHA_FILL = new RegExp(
  String.raw`\b(?:bg|border|border-[trblxy]|ring|outline|divide|from|via|to)-(${VOCABULARY})\/(\d{1,3})\b`,
  'g',
)

/**
 * The one site that spends an ink as a translucent fill and may.
 *
 * Spotlight tints its leading slide `bg-create/15` inside a `border-create/40`, both around 2:1 —
 * and neither carries the state alone: the same card's icon turns `text-create` at FULL token
 * when it leads, and `INKS` above holds that at 4.5. The band is emphasis on a state something
 * else already states, which is the same reading `DECORATIVE_GLYPHS` takes of a placeholder.
 */
const ALPHA_FILL_ALLOWED: Record<string, string> = {
  '/SpotlightCard.tsx': 'a tint on a state its own icon states at full `create`',
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
 * A glyph that INFORMS, held at the 3:1 of WCAG 1.4.11 rather than the 4.5 of a word. Two sites:
 * the type icon a media tile falls back to while its poster is being made, and the folder shape
 * an explorer tile is drawn as — which IS the message, the name under it saying nothing about
 * whether the tile is a folder or a file.
 */
const INFORMATIVE_GLYPHS = ['/MediaTile.tsx', '/EntryCard.tsx']

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
  // MEASURED on 2026-08-17, and it is NOT the ShelfTile case it used to claim: a folder tile is
  // `bare`, so its caption is `text-text` on the panel rather than white on a gradient — 13.3:1
  // dark and 16.1:1 light at full ink, but 4.28 and 3.20 once cut. A file tile keeps the gradient
  // and its ~17:1. The bar is missed in the light theme for a folder on its way out, and the
  // remedy is a decision about how a cut tile is drawn, not a token.
  '/EntryCard.tsx':
    'a tile that has been CUT and is waiting for a paste, dimmed as every file browser dims one — a picture has no ink to quieten, and a folder caption reads 3.20 while it waits',
  '/Tree.tsx':
    'the row a drag is holding, for the length of the gesture, while the ghost reads at full ink',
  '/TimelineRow.tsx':
    'the timeline row a drag is holding, for the length of the gesture — the same dimming as the outliner above, and the rows it reads against are at full ink',
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
 * Every token written at an opacity, composed on the surfaces of its vocabulary and measured
 * against the bar the caller's rule asks for. `barFor` answers `null` for a path that is exempt.
 *
 * ONE sweep for the words and the shapes, because the two rules differ in DATA and nowhere else —
 * which spelling paints, and what bar it owes. They were written twice and had already drifted in
 * the hour it took to review them: the second read `READING_SURFACES` where the first read
 * `SURFACES_OF`, so a `bg-danger/40` in a settings pane would have been measured on a dock.
 *
 * Taken as a function so a rule can be run against a source known to FAIL, which is what tells a
 * reader it measures anything at all.
 */
function alphaFailures(
  sources: readonly (readonly [string, string])[],
  spelling: RegExp,
  barFor: (path: string) => number | null,
): string[] {
  const failing: string[] = []

  for (const theme of THEMES) {
    const tokens = palette(theme.from)

    for (const [path, source] of sources) {
      const bar = barFor(path)
      if (bar === null) continue

      for (const [, ink = '', percent = ''] of source.matchAll(spelling)) {
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

/** A word written at an opacity: 4.5, or 3 for the one glyph that informs, or exempt. */
function inkFailures(sources: readonly (readonly [string, string])[]): string[] {
  return alphaFailures(sources, ALPHA_INK, path => {
    if (DECORATIVE_GLYPHS.some(one => path.endsWith(one))) return null
    return INFORMATIVE_GLYPHS.some(one => path.endsWith(one)) ? AA_NON_TEXT : AA_NORMAL_TEXT
  })
}

/** A shape drawn at an opacity: the 3:1 of WCAG 1.4.11, or exempt. */
function fillFailures(sources: readonly (readonly [string, string])[]): string[] {
  return alphaFailures(sources, ALPHA_FILL, path =>
    Object.keys(ALPHA_FILL_ALLOWED).some(one => path.endsWith(one)) ? null : AA_NON_TEXT,
  )
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
   * The green a sound clip is filled with, held against BOTH inks the strip paints on it: the
   * clip's name in `text`, at the 4.5 of WCAG 1.4.3, and its waveform in `muted`, at the 3 of
   * 1.4.11 — a shape rather than a word, and the one that decided how green the green could be.
   *
   * Measured rather than eyeballed because a canvas escapes every other rule in this file: the
   * painter reads these tokens through `engines/core/palette.ts`, so no class names them and no
   * sweep above composes them.
   */
  it('carries a sound clip the strip can be read on, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)
      const green = tokens['clip-audio'] ?? ''

      expect(green).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrastRatio(tokens.text ?? '', green)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
      expect(contrastRatio(tokens.muted ?? '', green)).toBeGreaterThanOrEqual(AA_NON_TEXT)
    }
  })

  /**
   * The calm end of the scale a meter paints a level on, held on BOTH grounds its canvases stand
   * on: the chassis under the programme wave, and the toolbar's own fill under the spectrum. The
   * other two bands are `warning` and `danger`, already measured as inks above; this one has no
   * sweep to fall under, being read by `engines/core/palette.ts` and named by no class.
   *
   * At the 3 of WCAG 1.4.11 rather than 4.5: a waveform and a meter bar are shapes that inform,
   * never words. Held apart from `create` too — one green meaning both "this is quiet" and "this
   * creates" is a green that cannot be moved for either.
   */
  it('carries a level a meter can be read at on both its grounds, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)
      const green = tokens['level-safe'] ?? ''

      expect(green).toMatch(/^#[0-9a-f]{6}$/)
      const failing = ['chassis', 'surface'].filter(
        ground => contrastRatio(green, tokens[ground] ?? '') < AA_NON_TEXT,
      )

      expect(failing).toEqual([])
      expect(green).not.toBe(tokens.create)
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
   * The other half of that pair, and it is the reason `rowSkin`'s loud fill swaps BOTH inks rather
   * than only the fill: the studio's ordinary ink does NOT clear the bar on the accent. Measured
   * rather than written in a comment beside the skin — a token nudged until `text` happened to pass
   * would leave `ROW_INK`'s variant looking like decoration.
   */
  it('leaves the ordinary ink unreadable on that same fill, in both themes', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      expect(contrastRatio(tokens.text ?? '', tokens.accent ?? '')).toBeLessThan(AA_NORMAL_TEXT)
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
   * The accent as a CONTROL against the surfaces it is drawn over — the title bar's drop target,
   * which rings the space a dragged pill would land in, and which is the only thing saying that
   * the drop will be taken. WCAG 1.4.11 asks 3:1 of it, and that is the second bar the accent is
   * pinned between: white on it needs the blue dark, a line drawn in it needs the blue light.
   *
   * The focus ring was this bar's first holder and is gone since 2026-08-15
   * (`design/no-focus-ring.test.ts`). The measurement stayed: the accent is still drawn as a
   * line, and a bar that outlives the reason it was written is a bar that has to name a new one.
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
    expect(inkFailures(WRITTEN_SOURCES)).toEqual([])
  })

  /**
   * The sweep run against a source that is KNOWN bad — the exact state `window-styles.ts` was in
   * before this batch. Without it, five one-line edits leave the rule green while it measures
   * nothing: `alpha = 1`, an emptied `SURFACES_OF`, the threshold lowered to the glyph bar, a path
   * added to the exemptions. A rule that cannot be shown to refuse anything refuses nothing.
   */
  it('refuses an ink that fails, which is the only way to know it measures at all', () => {
    const bad = inkFailures([['./probe.ts', "'text-base-content/60 text-xs'"]])

    expect(bad).toContain('./probe.ts base-content/60 on base-300')
    // And the same ink one step up passes, so the probe proves the threshold, not the sweep.
    expect(inkFailures([['./probe.ts', "'text-base-content/70'"]])).toEqual([])
  })

  /**
   * The shapes, where the sweep above holds the words. A control identified by nothing but a
   * translucent ink is a control a reader has to guess at — WCAG 1.4.11, 3:1, and the carousel's
   * pagination dots stood at 1.99 on a panel and 1.82 on a light one.
   */
  it('clears the 3:1 of a shape, wherever an ink is spent as a translucent fill', () => {
    expect(fillFailures(WRITTEN_SOURCES)).toEqual([])
  })

  it('refuses a fill that fails, and takes a scrim for what it is', () => {
    // The exact class the dots carried, and the ratio that closed this batch.
    expect(fillFailures([['./probe.tsx', "'bg-muted/40'"]])).toContain(
      './probe.tsx muted/40 on panel',
    )
    expect(fillFailures([['./probe.tsx', "'bg-muted'"]])).toEqual([])
    // A surface token spent as a translucent surface is a scrim, and owes no ratio.
    expect(fillFailures([['./probe.tsx', "'bg-panel/80 bg-chassis/75'"]])).toEqual([])
    // Nor does a gradient stop that names no token at all.
    expect(fillFailures([['./probe.tsx', "'from-black/85 via-black/45'"]])).toEqual([])
    // The spellings a first draft of this rule missed, each a way to draw the same shape.
    expect(fillFailures([['./probe.tsx', "'ring-muted/40'"]])).not.toEqual([])
    expect(fillFailures([['./probe.tsx', "'border-l-create/20'"]])).not.toEqual([])
    // `accent` is in the table for THIS rule alone and no source spends it yet, so without a probe
    // its entry could be deleted with every test still green — measured, it survived that mutant.
    expect(fillFailures([['./probe.tsx', "'bg-accent/30'"]])).not.toEqual([])
  })

  /**
   * The exemption, held by REPLAYING the rule rather than by asking whether the file still writes
   * an opacity. The difference is the whole value: Spotlight raised to 3:1 would keep an exemption
   * it no longer needs, and that exemption would silently cover the next translucent fill added
   * beside it — the exemption being by FILE, not by class.
   */
  it('carries no fill exemption for a source the rule would now pass', () => {
    const stale = Object.keys(ALPHA_FILL_ALLOWED).filter(
      one =>
        !WRITTEN_SOURCES.some(
          ([path, source]) =>
            path.endsWith(one) &&
            alphaFailures([['probe', source]], ALPHA_FILL, () => AA_NON_TEXT).length,
        ),
    )

    expect(stale).toEqual([])
    expect(Object.values(ALPHA_FILL_ALLOWED).filter(one => one.length < 20)).toEqual([])
  })

  /**
   * The fact the carousel's `w-4` rests on, measured here rather than recopied into a comment
   * beside it. `text` and `muted` are the two fills of a pagination dot, and 1.4.11 asks 3:1 of a
   * state — which they do NOT clear, so the current page has to be said by something else.
   */
  it('leaves two inks too close to tell a state apart on their own', () => {
    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      expect(contrastRatio(tokens.text ?? '', tokens.muted ?? '')).toBeLessThan(AA_NON_TEXT)
    }
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

/**
 * The take editor's selection, measured here for the reason `clip-audio` is: both of its marks
 * are drawn by a library reading `engines/core/palette.ts`, so no class names them and not one
 * of the sweeps above composes them. The surface under both is `bg-chassis`, from `MonitorFrame`.
 *
 * It is a PAIR, and the numbers are why. A veil that let the wave through could never clear the
 * 3:1 WCAG 1.4.11 asks of a control — the accent needs 98% of the mix on the dark chassis to get
 * there, which is not a veil at all — so the EDGES carry the state at the full token and the
 * veil is emphasis on top. The same reading `ALPHA_FILL_ALLOWED` takes of `Spotlight`.
 */
describe('the selection of the take editor', () => {
  const VEIL =
    /--color-accent-veil:\s*color-mix\(in srgb, var\(--color-accent\) (\d+)%, transparent\)/

  it('carries its state on edges at the full accent, the veil being what the wave shows through', () => {
    const [, percent = ''] = stylesheet.match(VEIL) ?? []
    // Read from the sheet, never recopied: a veil composed at an alpha nobody measures is the
    // defect this whole file exists to refuse.
    expect(percent).toMatch(/^\d+$/)

    for (const theme of THEMES) {
      const tokens = palette(theme.from)
      const veiled = blend(tokens.accent ?? '', tokens.chassis ?? '', Number(percent) / 100)

      // The edges, at the bar a control owes — the same one the accent answers as a line.
      expect(contrastRatio(tokens.accent ?? '', tokens.chassis ?? '')).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      )
      // The veil, which does NOT reach it. Written as a measurement rather than left unsaid:
      // this is the fact the edges exist for, and raising the alpha would not fix it.
      expect(contrastRatio(veiled, tokens.chassis ?? '')).toBeLessThan(AA_NON_TEXT)
      // And what the veil is for: the wave under it stays a shape one can still read.
      expect(contrastRatio(tokens.muted ?? '', veiled)).toBeGreaterThanOrEqual(AA_NON_TEXT)
    }
  })

  /**
   * The edges and their colour are joined by a class name and a shadow part, and by nothing a
   * compiler can follow: rename either and the border quietly falls back to the plugin's own
   * black, with every suite green — the failure `--sc-tooltip` taught this file.
   */
  it('is joined to its surface by a class the editor actually writes', () => {
    const editor = WRITTEN_SOURCES.find(([path]) => path.endsWith('/TakeEditor.tsx'))

    expect(editor?.[1]).toContain('sc-wave')
    expect(stylesheet).toContain('.sc-wave div::part(region-handle-left)')
  })

  /**
   * Tailwind prunes the `@theme` variables nothing names, and this one is never a class: it is
   * read by NAME in JavaScript. Composing that name would drop the declaration from `:root`
   * altogether, and the editor would hand the region an empty string — an invisible selection,
   * with nothing on screen or in a suite to say why.
   */
  it('names the veil in full somewhere, which is what keeps it in the sheet at all', () => {
    const written = WRITTEN_SOURCES.filter(([, source]) => source.includes("'--color-accent-veil'"))

    expect(written).not.toEqual([])
  })
})
