import { describe, expect, it } from 'vitest'
import {
  BUTTON_NEUTRAL,
  COLOR_READOUT,
  CONTROL,
  FIELD,
  FIELD_FILL,
  NATIVE_SELECT,
  OVERLAY_BUTTON,
  PANEL_BAR,
  PANEL_GROUP_LABEL,
  PANEL_GROUP_LABEL_WIDE,
  PANEL_HEAD,
  ROW_INK,
  ROW_LINE,
  ROW_QUIET,
  ROW_SUBJECT,
  rowSkin,
  SLIDER_HANDLE,
  TILE_QUIET,
  TITLE_BAR_GHOST,
  TITLE_BAR_TRIGGER,
  TOOLBAR_LABEL,
} from './styles'
import { rewrites, spellsOut, WRITTEN_SOURCES } from './testHarness'
import stylesheet from '../index.css?raw'
import toolButton from './ToolButton.tsx?raw'

/**
 * Read off the skin rather than spelled out again, so a change of shade moves the rule with it.
 * Only the background: `hover:text-text` is worn all over the studio and says nothing about which
 * bar one is in, whereas the half-opaque fill belongs to this one.
 */
const OWN_HOVER = TITLE_BAR_GHOST.split(' ').filter(one => one.startsWith('hover:bg-'))

/** As `WRITTEN_SOURCES` keys it: the glob resolves against `testHarness.ts`, its own neighbour. */
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
   * The surfaces of the studio that fill under the pointer, named rather than counted.
   *
   * A `tile` is the one thing `rowSkin` fills for, and it is asked for by name — so who may ask
   * is the rule. This one is a tile in the strict sense: nothing else about it looks like a
   * control, so the fill is the whole of what says it can be pressed.
   *
   * There were two until 2026-08-19, when the texture channels stopped being tiles and became
   * link rows of the inspector — where the rule below is that nothing fills at all.
   *
   * The inspector is deliberately absent, and that is a decision of 2026-08-14: no line of it
   * answers the pointer. The cost was stated when it was taken — nothing distinguishes a line one
   * can open from a line one only reads, and what says a row opens is its tooltip.
   */
  const MAY_FILL_UNDER_THE_POINTER = [
    '../home/sections/Tools/ToolsGroup.tsx',
    // Back to two on 2026-08-20: the tiles a new scene picks its template from. A tile in the
    // same strict sense — a still and a name, and nothing else on it that looks like a control.
    '../newDocument/NewDocumentWindow/NewDocumentTemplates.tsx',
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
 * ONE fill for a chosen row, whichever list holds it. There were two until 17 August: the projects
 * panel asked for `bg-accent` — the full accent, which the studio spends on what one ACTIONS — and
 * that made one list read as a different blue from every other. The type that let a caller ask is
 * gone, so the COMPILER refuses a second tone; what is left to check here is the fill itself.
 */
describe('the fill of a chosen row', () => {
  it('is the soft accent, and never the full one', () => {
    expect(rowSkin(true).split(' ')).toContain('bg-accent-soft')
    expect(rowSkin(true).split(' ')).not.toContain('bg-accent')
  })

  it('leaves a row nobody chose without a fill at all', () => {
    expect(rowSkin(false)).not.toContain('bg-accent')
  })

  /**
   * The ink that went with the loud fill is gone with it. `accent-content` is pure white, needed
   * only where `accent` is the background — a row now fills with `accent-soft`, on which `text`
   * clears 4.5 on its own, and `tokens.test.ts` holds that ratio.
   */
  it('no longer takes either ink to the white the full accent demanded', () => {
    for (const ink of [ROW_INK, ROW_QUIET]) expect(ink).not.toContain('accent-content')
    expect(ROW_INK).toContain('text-text')
    expect(ROW_QUIET).toContain('text-muted')
  })

  /**
   * The rule the compiler cannot state: no surface may reach for the full accent as a FILL under a
   * row. `bg-accent` belongs to a control — a button, a tool in use, a filled gauge.
   *
   * **Two blind spots, both measured.** It reads the FILE, not the element, so a row and a real
   * button in one file passes — and so does `RefBadge`, whose full-accent tag is drawn inside a
   * row from another file. And `\b` alone would match `bg-accent-soft`, since `-` ends a word.
   */
  const fillsWithTheFullAccent = (source: string) =>
    /\browSkin\(/.test(source) && /\bbg-accent(?![-/])/.test(source)

  it('is drawn by no list that also writes the full accent', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && fillsWithTheFullAccent(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  // The partner of the rule above: a sweep that can only ever return `[]` proves nothing.
  it('tells the full accent from the soft one it is written beside', () => {
    expect(fillsWithTheFullAccent("rowSkin(true)\ncn('bg-accent text-accent-content')")).toBe(true)
    expect(fillsWithTheFullAccent("rowSkin(true)\ncn('bg-accent-soft')")).toBe(false)
    expect(fillsWithTheFullAccent("rowSkin(true)\ncn('hover:bg-accent-hover')")).toBe(false)
    expect(fillsWithTheFullAccent("cn('bg-accent')")).toBe(false)
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

/**
 * All three words are required, and `text-tiny` is what does the work: `text-muted … px-1` alone
 * is worn by the zoom readout of the image space, which is a BUTTON one clicks to return to
 * 100 % and not a word the bar sets down. A rule without it would call that a violation.
 */
const rewritesLabel = spellsOut(TOOLBAR_LABEL.split(' '))

describe('the word a bar sets beside its buttons', () => {
  it('carries the ink, the size and the room around it, and nothing else', () => {
    expect(TOOLBAR_LABEL.split(' ')).toEqual(['text-muted', 'text-tiny', 'px-1'])
  })

  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && rewritesLabel(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('reads the three in any order, since the formatter leaves the order alone', () => {
    expect(rewritesLabel('"text-muted text-tiny px-1"')).toBe(true)
    expect(rewritesLabel('"text-tiny text-muted px-1"')).toBe(true)
  })

  it('leaves alone what only shares two of the three, or a longer word that starts the same', () => {
    // The zoom readout of the image space, the manual's inline code, and the gauge a looser
    // substring rule would have read as `px-1`.
    expect(rewritesLabel('"text-muted w-auto px-1 tabular-nums"')).toBe(false)
    expect(rewritesLabel('"bg-base-300 text-tiny rounded px-1 py-0.5"')).toBe(false)
    expect(rewritesLabel('"text-muted text-tiny px-10"')).toBe(false)
  })

  // The partner of the rule above, and the same reason: a constant nobody wears is a dead export.
  it('is worn by the sites it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('TOOLBAR_LABEL'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(4)
  })
})

/** The shape the four native pickers had before they were given a constant. */
const repadsControl = rewrites('CONTROL', ['px-1'])

describe('the OS list wearing the control language', () => {
  it('is the control, plus the room around its text and nothing more', () => {
    expect(NATIVE_SELECT.split(' ')).toEqual([...CONTROL.split(' '), 'px-1'])
  })

  it('is worn rather than padded again at the call', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && repadsControl(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves alone the callers whose own padding is not this one', () => {
    // The search field of `CollectionBar`, which pulls its left inset in for the magnifier, and
    // the colour swatch of the image space — both wear `CONTROL` and neither is a picker.
    expect(repadsControl("cn(CONTROL, 'w-full px-1')")).toBe(true)
    expect(repadsControl("cn(CONTROL, 'w-full py-0 pr-2 pl-7')")).toBe(false)
    expect(repadsControl("cn(CONTROL, 'w-(--sc-control) cursor-pointer border-none p-0.5')")).toBe(
      false,
    )
  })

  /**
   * It was extracted from four pickers and is now worn by ONE, which is the stronger rule: a
   * second wearer means a `<select>` was drawn by hand again instead of through `SelectField`,
   * and that is how twenty-one of them each read their own value back into their own union.
   */
  it('is worn by `SelectField`, and by nothing else', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('NATIVE_SELECT'),
    ).map(([path]) => path)

    expect(wearing).toEqual([expect.stringContaining('SelectField.tsx')])
  })
})

/**
 * The way a field was made to fill its line before it had a constant. Both words together and
 * never one, which is what `rewrites` gives: `min-w-0 flex-1` is the studio's commonest pair of
 * layout classes, worn by thirty-odd elements that are not fields at all, and either half on its
 * own is a caller dividing its own row rather than reaching for this shape.
 */
const refillsField = rewrites('FIELD', ['min-w-0', 'flex-1'])

describe('the field that takes what its line has left', () => {
  it('is the field, plus the room it claims and nothing more', () => {
    expect(FIELD_FILL.split(' ')).toEqual([...FIELD.split(' '), 'min-w-0', 'flex-1'])
  })

  it('is worn rather than spread again at the call', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && refillsField(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves alone the callers whose own width is not this one', () => {
    // The shape the four fields had before the constant, then the rename dialog's field — held
    // to the width of its box rather than to a share of a row — and a colour swatch, which is
    // square. Last, one half of the pair: a caller stopping an overflow it can see.
    expect(refillsField("cn(FIELD, 'text-tiny min-w-0 flex-1')")).toBe(true)
    expect(refillsField("cn(FIELD, 'w-full text-xs')")).toBe(false)
    expect(refillsField("cn(FIELD, 'px-1')")).toBe(false)
    expect(refillsField("cn(FIELD, 'min-w-0 truncate')")).toBe(false)
  })

  // The partner of the rule above: a constant nobody wears is a dead export.
  it('is worn by the four fields it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('FIELD_FILL'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(4)
  })
})

/**
 * The gauge and the room a NAMED control of the title bar takes, which the assistant's entry and
 * the account trigger had each written out. The pills beside them are not this shape and keep
 * their own `gap-2 px-3 py-1`: a pill is as wide as the space it stands for.
 */
const respacesTitleBar = rewrites('TITLE_BAR_GHOST', ['h-(--sc-control)', 'px-2'])

describe('the named control of a title bar', () => {
  it('is the ghost, plus the gauge and the room around its word', () => {
    expect(TITLE_BAR_TRIGGER.split(' ')).toEqual([
      ...TITLE_BAR_GHOST.split(' '),
      'text-tiny',
      'h-(--sc-control)',
      'gap-1.5',
      'px-2',
    ])
  })

  it('is worn rather than sized again at the call', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && respacesTitleBar(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves alone the pills, whose room is their own', () => {
    expect(respacesTitleBar("cn(TITLE_BAR_GHOST, 'text-tiny h-(--sc-control) gap-1.5 px-2')")).toBe(
      true,
    )
    expect(respacesTitleBar("cn(TITLE_BAR_GHOST, 'gap-2 px-3 py-1')")).toBe(false)
  })

  // The partner of the rule above: a constant nobody wears is a dead export.
  it('is worn by the two controls it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && source.includes('TITLE_BAR_TRIGGER'),
    )

    expect(wearing.length).toBeGreaterThanOrEqual(2)
  })
})

/** The blind spot of `rewrites`: a site that never wore the constant leaves no call to read. */
const spellsOutRowLine = spellsOut(ROW_LINE.split(' '))

describe('the shape of a row line', () => {
  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutRowLine(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  // Named rather than counted: a count stays green when one site drops the constant and another
  // picks it up, and a fifth adopting it fails here ON PURPOSE. **Blind**: raw text, so `Row.tsx`
  // would still count on the comment that names the constant, with no `cn()` left.
  it('is worn by the four that draw a line', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\bROW_LINE\b/.test(source),
    ).map(([path]) => path)

    expect(wearing.sort()).toEqual([
      '../panels/inspector/StylesSection/StylesSectionRow.tsx',
      '../panels/projects/ProjectRow.tsx',
      './Row.tsx',
      './Tree.tsx',
    ])
  })
})

/**
 * All four words or none: `text-muted` with `uppercase` is also a caption that titles nothing.
 * The two group titles of the SETTINGS windows sit one word away, on `text-base-content/70` —
 * DaisyUI ink, and a window harmonised towards `text-muted` would be told off by this wrongly.
 */
const spellsOutGroupLabel = spellsOut(PANEL_GROUP_LABEL.split(' '))

/** The three the wide one adds to claim its line, required together or not at all. */
const widensGroupLabel = rewrites('PANEL_GROUP_LABEL', ['min-w-0', 'flex-1', 'truncate'])

describe('the word that names a group in a panel', () => {
  it('is the label, plus what a wide one claims of its line and nothing more', () => {
    expect(PANEL_GROUP_LABEL_WIDE.split(' ')).toEqual([
      ...PANEL_GROUP_LABEL.split(' '),
      'min-w-0',
      'flex-1',
      'truncate',
      'font-medium',
    ])
  })

  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutGroupLabel(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('is worn rather than widened again at the call', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && widensGroupLabel(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  // Named rather than counted, and `DiffImages` wears it twice — the two sides of a comparison.
  // **Blind**: raw text, so a file naming the constant in a comment alone would still count.
  it('is worn by the four files it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\bPANEL_GROUP_LABEL(?:_WIDE)?\b/.test(source),
    ).map(([path]) => path)

    expect(wearing.sort()).toEqual([
      '../panels/git/GitFileGroup.tsx',
      '../panels/history/CommitFiles.tsx',
      '../panels/history/DiffImages.tsx',
      './DynamicForm/DynamicForm.tsx',
    ])
  })
})

/**
 * All five words or none: the hexadecimal `ColorField` writes beside its swatch is the same shape
 * one ink away — four of these words plus `text-muted` — and telling it off would be telling off
 * the wrong thing.
 */
const spellsOutSubject = spellsOut(ROW_SUBJECT.split(' '))

describe('what a line names', () => {
  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutSubject(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves the muted readout of a colour alone, which shares four of the five', () => {
    expect(spellsOutSubject(`'${COLOR_READOUT}'`)).toBe(false)
  })

  // Named rather than counted: a count stays green when one site drops the constant and another
  // picks it up. **Blind**: raw text, so a comment naming the constant would count as wearing it.
  it('is worn by the two it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\bROW_SUBJECT\b/.test(source),
    ).map(([path]) => path)

    expect(wearing.sort()).toEqual([
      '../panels/history/DiffPane.tsx',
      '../panels/history/HistoryRow.tsx',
      '../panels/inspector/StylesSection/StylesSectionRow.tsx',
    ])
  })
})

/**
 * The whole set: the two windows that stack a column the same way rule it off in DaisyUI ink
 * (`border-base-300`), which is the other side of a border this file has no say over.
 */
const spellsOutPanelHead = spellsOut(PANEL_HEAD.split(' '))

describe('the box a panel puts above what it acts on', () => {
  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutPanelHead(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves alone a column ruled off in the other vocabulary', () => {
    expect(spellsOutPanelHead("'border-base-300 flex flex-col gap-2 border-b p-2'")).toBe(false)
  })

  // Named rather than counted. **Blind**: raw text, as above.
  it('is worn by the two it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\bPANEL_HEAD\b/.test(source),
    ).map(([path]) => path)

    expect(wearing.sort()).toEqual([
      '../panels/git/CommitBox.tsx',
      './CollectionBar/CollectionBar.tsx',
    ])
  })
})

/**
 * The whole set, which is what leaves the activity list's own bar alone: it rules off the same
 * way with a tighter gap, and a rule reading four of these five words would move it by 2px.
 */
const spellsOutPanelBar = spellsOut(PANEL_BAR.split(' '))

describe('the line a pane draws above what it shows', () => {
  it('is worn rather than written out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutPanelBar(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves alone the bar of the activity list, which sets its buttons closer', () => {
    expect(spellsOutPanelBar("'border-border flex items-center gap-1.5 border-b p-1'")).toBe(false)
  })

  // Named rather than counted. **Blind**: raw text, as above.
  it('is worn by the five it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && /\bPANEL_BAR\b/.test(source),
    ).map(([path]) => path)

    expect(wearing.sort()).toEqual([
      '../panels/git/GitReady.tsx',
      '../panels/git/RemoteSetup.tsx',
      '../panels/history/DiffPane.tsx',
      './CollectionBar/CollectionBar.tsx',
      './FormHeader.tsx',
    ])
  })
})

/** The set, in one string: a site that never wore the constant leaves no call to read. */
const spellsOutHandle = spellsOut(SLIDER_HANDLE.split(' '))

/**
 * The one file that may hold a `<input type="range">`, and the rule is about the RAIL: the studio
 * drew three of them — a native track, a hand-made one and daisyUI's — before this list existed,
 * and each was written by a site reaching for the input on its own. A fourth would arrive the same
 * way and pass every other guard, each of them reading tokens it wears properly.
 *
 * It named two until `SliderHandle` was pulled out of them: `Slider` and `RangeField` now compose
 * it, and a range input is written in exactly one place.
 */
const SLIDER_OWNERS = ['./SliderHandle.tsx']

describe('the slider of the studio', () => {
  it('is the only kind of input allowed to be a range', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => !SLIDER_OWNERS.includes(path) && source.includes('type="range"'),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('is written by the one that owns it, so the rule cannot pass on a studio without sliders', () => {
    const owners = WRITTEN_SOURCES.filter(([, source]) => source.includes('type="range"')).map(
      ([path]) => path,
    )

    expect(owners.sort()).toEqual(SLIDER_OWNERS)
  })

  /** Named rather than counted. **Blind**: raw text, so a mention in a comment reads as a wearer. */
  it('is worn by the two it was extracted from', () => {
    const wearing = WRITTEN_SOURCES.filter(([, source]) => /\bSliderHandle\b/.test(source))
      .map(([path]) => path)
      .filter(path => !SLIDER_OWNERS.includes(path))

    expect(wearing.sort()).toEqual(['./RangeField.tsx', './Slider.tsx'])
  })

  it('wears the shared handle rather than writing it out again', () => {
    const offenders = WRITTEN_SOURCES.filter(
      ([path, source]) => path !== GUARDED && spellsOutHandle(source),
    ).map(([path]) => path)

    expect(offenders).toEqual([])
  })

  it('leaves alone an input that merely covers its host', () => {
    expect(spellsOutHandle("'absolute inset-0 m-0 size-full'")).toBe(false)
  })
})

/**
 * The header glyph is written twice — as a number in `HOSTS`, which `UiIcon` takes, and as a gauge
 * in the sheet, which `--sc-row-action-bleed` derives the end-column lean from. Nothing else holds
 * them together: moved alone, the button's icon would shift by half its change and the column it
 * lands on would not follow.
 *
 * **Blind**: raw text on both sides, so a second `glyph: 14` written for another host would satisfy
 * this rule without being the one it means.
 */
describe('the header glyph', () => {
  it('is the same number in the sheet as in the button', () => {
    const gauge = /--sc-icon-header:\s*(\d+)px/.exec(stylesheet)?.[1]
    const host = /header:\s*\{[^}]*glyph:\s*(\d+)/.exec(toolButton)?.[1]

    expect(gauge).toBeDefined()
    expect(host).toBe(gauge)
  })
})
