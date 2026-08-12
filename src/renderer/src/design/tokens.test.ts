import { describe, expect, it } from 'vitest'
import { AA_NON_TEXT, AA_NORMAL_TEXT, blend, contrastRatio } from '@shared/domain/color'
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
 * Three placeholders, exempt and measured: a crossed-out image on an empty thumbnail (1.65:1 at
 * `/30`), the same on a media tile, and the large glyph of an empty state (1.96 at `/40`).
 *
 * They carry no information a word does not already carry beside them — `EmptyState` renders its
 * sentence in full `muted` right under the glyph — so WCAG 1.4.11 does not reach them. **Raising
 * them would say the placeholder is the message**, which is the opposite of what an empty frame
 * means. This is a decision, not an oversight.
 */
const DECORATIVE_GLYPHS = ['/Thumbnail.tsx', '/MediaTile.tsx', '/EmptyState.tsx']

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
  it('clears AA once composed, wherever an ink is written with an alpha', () => {
    const failing: string[] = []

    for (const theme of THEMES) {
      const tokens = palette(theme.from)

      for (const [path, source] of WRITTEN_SOURCES) {
        if (DECORATIVE_GLYPHS.some(one => path.endsWith(one))) continue

        for (const [, ink = '', percent = ''] of source.matchAll(ALPHA_INK)) {
          const alpha = Number(percent) / 100

          for (const surface of SURFACES_OF[ink] ?? []) {
            const seen = blend(tokens[ink] ?? '', tokens[surface] ?? '', alpha)
            const ratio = contrastRatio(seen, tokens[surface] ?? '')
            if (ratio < AA_NORMAL_TEXT) failing.push(`${path} ${ink}/${percent} on ${surface}`)
          }
        }
      }
    }

    expect(failing).toEqual([])
  })

  it('finds an alpha ink at all, so the rule above cannot pass on an empty sweep', () => {
    const written = WRITTEN_SOURCES.filter(([, source]) => ALPHA_INK.test(source))
    ALPHA_INK.lastIndex = 0

    expect(written.length).toBeGreaterThanOrEqual(8)
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
