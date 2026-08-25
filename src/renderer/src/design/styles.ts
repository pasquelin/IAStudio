import { cn } from '@/helpers/cn'

/**
 * Class strings shared by more than one component in `design/`. A shape used by a single
 * component stays in that component's file — what lands here is what would otherwise drift
 * apart, and every name here has to be unique across the folder.
 */

/**
 * The chrome every button of the docks shares, whether it carries a glyph or a label. Its own
 * gauge is left to the caller: `ToolButton` is square, `Button` is as wide as its word.
 */
export const BUTTON_BASE = cn(
  'inline-flex cursor-pointer items-center justify-center rounded-(--radius-sc-md)',
  'border-none transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-40',
)

/**
 * What a button of the docks is FILLED with when it is not the one action a surface exists for —
 * the fill, the ink written on it, and what the pointer does to that fill.
 *
 * Apart from `BUTTON_BASE` because the two answer different questions: that one is the shape,
 * this one is the colour. **A site can want the chrome and not the fill, and
 * `ToolButton` is the witness**: it takes `BUTTON_BASE` over `bg-transparent`, because a tool sits
 * on the bar it belongs to rather than on a surface of its own.
 *
 * Worn by `Button`'s neutral variant, and by that alone since `Spark`'s idea card was removed —
 * this paragraph named it as a second site for a good while after it had gone. It stays a shared
 * constant all the same: `Counts` reaches the same PAIR of classes by another road, and the day
 * a second component wants the fill without `Button`'s geometry, the answer must not be a copy.
 *
 * **`Counts` reaches the same pair and is NOT a second site**, which is worth writing because the
 * classes look identical: it gets its hover from `rowSkin` and writes `bg-surface` beside it, so
 * what it is is a ROW that happens to sit on a surface — smaller radius, a `group/row` its
 * subtitle reads, and a refused state. Unifying the two was measured and refused on 2026-08-12.
 */
export const BUTTON_NEUTRAL = 'bg-surface text-text hover:bg-elevated'

/**
 * A button laid OVER what it acts on, rather than around it.
 *
 * The shape four surfaces reached for independently — a shelf tile, a texture channel, a texture
 * slot, a model's material — and always for the same reason: those hosts render a `figure`, a
 * `div` or a `p`, and a `button` takes phrasing content only. Wrapping them is invalid HTML, so
 * the press target is drawn on top instead, invisible and the size of its host.
 *
 * The RADIUS stays with the caller, as `BUTTON_BASE` leaves the gauge: it has to match the host's
 * corner, and the four hosts do not share one. No fill either — a surface that is invisible at
 * rest and lights up under the pointer is a decision for the host to take (`rowSkin`), not one
 * this shape should smuggle in.
 */
export const OVERLAY_BUTTON = 'absolute inset-0 cursor-pointer border-none bg-transparent'

/**
 * The control language shared by the bars: same height token, so the density setting reaches
 * every one of them at once.
 */
export const CONTROL = 'bg-surface text-text h-(--sc-control) rounded-(--radius-sc-md) text-tiny'

/**
 * The OS list, wearing the studio's control language — a blend mode, an animation clip, a bone,
 * a model. Four of them, chosen native each time for the same reason: past a dozen entries the
 * OS list is searchable by keystroke and a flyout is a menu to scroll.
 *
 * The room around the text is the whole of what this adds to `CONTROL`, and it is here because
 * it was the same decision four times. The WIDTH is not: it belongs to the host — a full row in
 * an inspector, a capped one on a toolbar — and stays at the call site.
 */
export const NATIVE_SELECT = cn(CONTROL, 'px-1')

/**
 * A button of the status line. Icon-first, the glyph measured 12 x 12 — half of what WCAG 2.2
 * SC 2.5.8 asks — and only the criterion's spacing exception saved them.
 *
 * The pull-back is what lets the target grow without the line growing under it: the footer has
 * no height of its own, so a control-tall button takes it from 29px to 40 (measured, both ways).
 */
export const STATUS_BUTTON = cn(
  'hover:text-text -my-(--sc-gutter) flex h-(--sc-control) min-w-(--sc-control)',
  'items-center justify-center gap-1.5',
)

/**
 * A control laid over a canvas rather than in a bar: the view name on each 3D pane, which opens
 * that pane's menu.
 *
 * Pointer events are turned back ON here because the grid above the canvas turns them off — a
 * drag has to reach the viewport, and only the words are allowed to catch it. The translucent
 * panel fill is what keeps the word readable over whatever the scene renders behind it.
 */
export const CANVAS_TRIGGER = cn(
  'text-muted hover:text-text bg-panel/80 pointer-events-auto cursor-pointer',
  'text-mini flex items-center gap-1.5 whitespace-nowrap',
  'rounded-(--radius-sc-sm) border-none px-1.5 py-0.5',
)

/**
 * An action worded INSIDE a sentence — the home's "restore them" is the one so far.
 *
 * A `button` rather than an `a`: nothing is navigated to, and a link that goes nowhere is a
 * promise the browser cannot keep. Underlined all the same, because inside running text the
 * colour alone is what a reader is asked not to rely on (WCAG SC 1.4.1). It takes the size of
 * the sentence around it, so no text token is set here.
 */
export const INLINE_LINK = cn(
  'text-accent-ink cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
  'p-0 underline',
)

/**
 * A control of the title bar: the space pills on one end, the account trigger on the other.
 * Nothing until hovered, so the bar reads as a row of destinations rather than as a strip of
 * buttons. Gauge, padding and the active state stay with the caller — a pill is as wide as its
 * word, the account trigger is capped.
 *
 * Its own hover, half-opaque, is what makes it the title bar's and not a toolbar's: `ToolButton`
 * lights up at full `elevated`, and a bar of destinations that answered as loudly as a tool would
 * read as a strip of tools.
 */
export const TITLE_BAR_GHOST = cn(
  'flex cursor-pointer items-center rounded-(--radius-sc-md) border-none',
  'text-muted bg-transparent transition-colors',
  'hover:bg-elevated/60 hover:text-text',
)

/**
 * The two of them that OPEN something rather than switch to it — the assistant's entry, the
 * account trigger. Both carry an icon and a word at the gauge, which is what the pills beside
 * them do not: a pill is as wide as the space it stands for and pads to match.
 */
export const TITLE_BAR_TRIGGER = cn(TITLE_BAR_GHOST, 'text-tiny h-(--sc-control) gap-1.5 px-2')

/**
 * The shape of ONE LINE: how it is laid out, and its inset from whatever paints the fill.
 *
 * **No gutter.** It carried one, and the gutter is what a line of CONTROLS wants — between a
 * glyph and a word that belong together it is dead space, and between two columns that already
 * have a width of their own it is dead space twice over. `Tree` stacks three such columns, and
 * the gutters between them added 12px to every line of every panel in the studio, on top of an
 * inset the columns did not need either. What separates the tree's columns is their own width;
 * `Row` adds the half-step where it really does hold a glyph beside a word.
 *
 * Written here because `Tree` and `Row` must AGREE on it: the tree draws the indent and the
 * chevron, the row draws the icon and the name, and the two meet in the middle of every line.
 */
export const ROW_LINE = 'flex h-full items-center px-1'

/**
 * Hover and selection of one line in a list. The same line must not light up differently
 * depending on whether a `Tree` or a `Collection` is holding it — nor on which list it is, which
 * is the whole of why there is one fill here and no second tone to ask for.
 *
 * Everything past `selected` is named rather than positional, and `surface` is why: it arrived as
 * a fourth boolean, and the one call that needed it had to spell out the two defaults in front of
 * it — `rowSkin(picked, false, 'soft', false)`, four values of which three say nothing.
 */
export type RowSkin = {
  /**
   * What is wearing the skin, and the one thing that decides whether the pointer fills anything.
   *
   * A `row` answers no, and both surfaces that draw one agree: rows sit shoulder to shoulder, so
   * a fill following the pointer reads as a block sliding over the list rather than as one line
   * answering — and running past a picked row it briefly wears the same weight as the selection
   * it is meant to sit beside. What says where the pointer is in a list is the pointer.
   *
   * A `tile` answers yes — the home's tools, a texture channel — because there the fill is the
   * whole of what says the tile can be pressed: nothing else about it looks like a control. Its
   * quiet ink goes with it, and has its own constant: `TILE_QUIET`.
   */
  surface?: 'row' | 'tile'
  disabled?: boolean
}

export function rowSkin(
  selected: boolean,
  // `row` by default, which is what the function is called: a surface arriving here without a
  // word on the subject is a list until it says otherwise, and a list that quietly took a hover
  // back is the defect this batch went to remove.
  { surface = 'row', disabled }: RowSkin = {},
): string {
  // `elevated` is the studio's hover token — what a toolbar button lights up with.
  return cn(
    'rounded-(--radius-sc-sm)',
    // Named, and paired with `data-selected` on the SAME element: `Row` reads both to lift its
    // title and its subtitle out of `muted`, which carries 3.25:1 on `accent-soft`.
    //
    // A refused row takes no group, because its background does not answer a pointer either —
    // and a row that is refused WHILE selected therefore keeps the muted subtitle on
    // `accent-soft`. That case is real (`Models.tsx` can hold a pick the plan no longer allows)
    // and it is left alone knowingly: `opacity-40` is already on it, and WCAG 1.4.3 exempts a
    // disabled control. Lifting the ink there would say the row is available.
    !disabled && 'group/row',
    selected && 'bg-accent-soft',
    // Three refusals in one condition rather than a fill written and then undone: a `hover:` that
    // exists only to cancel another `hover:` is one class the day either of them moves.
    surface === 'tile' && !selected && !disabled && 'hover:bg-elevated',
    // A refused line that still lit up under the pointer read as pickable right until the click
    // that does nothing. `MenuRow` reached the same pair on its own — this is where a list row
    // gets it, so `Tree` inherits it too.
    disabled && 'cursor-not-allowed opacity-40',
  )
}

/**
 * The quiet ink of a word that lives INSIDE a row — a subtitle, a kind, the help under a tile.
 *
 * `muted` is quiet enough at rest and not enough once the row is PICKED: it carries 3.25:1 on
 * `accent-soft`, under the 4.5 of WCAG 1.4.3. Raising the token would repaint every dimmed word in
 * the studio, so the word is lifted on that state instead — read from `rowSkin`'s group, which is
 * why no list has to pass its state down.
 *
 * It once carried a hover lift beside it, for `elevated` at 3.51:1. That fill left the lists on
 * 2026-08-14 and the lift went with it: a variant firing on a background that no longer moves is
 * a word brightening under the pointer for no reason a reader could name. What still hovers is a
 * TILE, and it wears `TILE_QUIET` below rather than writing the variant out again.
 *
 * Written once because five sites had reached the same classes, one of them twice. A site whose
 * row has no selection carries the variant harmlessly: the attribute never appears.
 */
export const ROW_QUIET = cn('text-muted transition-colors', 'group-data-selected/row:text-text')

/**
 * The same quiet ink on a surface that still FILLS under the pointer — `rowSkin`'s `tile`, and
 * nothing else. `muted` reads 3.51:1 on `elevated`, under the 4.5 of WCAG 1.4.3, so the word has
 * to leave it exactly where that fill arrives.
 *
 * A constant rather than the variant written at each tile, and the reason is the guard next door:
 * `styles.test.ts` refuses `group-hover/row:text-text` anywhere outside this file. Without this
 * export that rule could only be kept as a list of filenames allowed to break it, which is a rule
 * that stops refusing anything the moment a second name is added to it.
 */
export const TILE_QUIET = cn(ROW_QUIET, 'group-hover/row:text-text')

/** The ink of the NAME in a row — the counterpart of `ROW_QUIET`, which lifts under it. */
export const ROW_INK = 'text-text transition-colors'

/**
 * A file's extension shown beside a name that does not carry it — the naming field's, and any
 * other surface that is not a row. Monospaced because it is a file's spelling, not a word.
 */
export const FILE_EXTENSION = 'text-muted font-mono'

/**
 * The same at the end of a row's title, where the ink has to lift with the row — `ROW_QUIET`.
 * `shrink-0`, so a name too wide for the panel is what gets cut, never the extension.
 */
export const ROW_SUFFIX = cn(ROW_QUIET, 'ml-1 shrink-0 font-mono')

/**
 * What a line NAMES, among metadata left muted beside it: the room the rest leaves, cut short.
 * No transition, unlike `ROW_INK` — these words never change ink, and a row that lifts its name
 * on selection wants the pair above instead.
 */
export const ROW_SUBJECT = 'text-text min-w-0 flex-1 truncate text-xs'

/**
 * A labelled toggle: the shape buttons of a texture, the view modes of a sky, the shelves of the
 * home. Written once because three surfaces had it, and one had already drifted — it lit up in
 * `accent-soft` where the others use `elevated`, the studio's hover token.
 *
 * The journal's filters were a fourth, and are no longer: eleven of these took a third of the
 * panel, and they are a menu now. A chip suits a handful of choices that all fit on one row.
 */
export function chipSkin(active: boolean): string {
  return cn(
    'h-(--sc-control) cursor-pointer rounded-(--radius-sc-sm) border-none px-2 text-xs',
    active ? 'bg-elevated text-text' : 'text-muted hover:text-text bg-transparent',
  )
}

/**
 * `--sc-control` at its tallest, as a number — what `useGauge` falls back on when the gauge
 * cannot be read, and nothing else. No call site passes it any more: three did, each of them
 * right at one density only, and `useRowHeight` now reads the gauge once for both virtualized
 * surfaces.
 *
 * A surface whose rows are sized by the gauge itself must read the gauge, not this: the two part
 * company in compact density, and the difference is reserved space nobody paints.
 */
export const LIST_ROW_HEIGHT = 28

/**
 * `--sc-row-stacked` at its tallest, as a number — the fallback for a list whose rows stack a
 * name over a subtitle, where `LIST_ROW_HEIGHT` leaves no room at all.
 *
 * Like its neighbour, this is the value a gauge that cannot be read falls back to, never the
 * value to write at a call site: `useRowHeight` reads the gauge, and a caller passing a number
 * would go back to being right at one density only.
 */
export const STACKED_ROW_HEIGHT = 36

/**
 * `--sc-row-filled` at its tallest, as a number — two steps of text with the room a fill takes
 * off them. Only the home's projects list asks for it.
 */
export const FILLED_ROW_HEIGHT = 44

/** `--sc-row-media` at its tallest, as a number. Same rule as its neighbours: a fallback only. */
export const MEDIA_ROW_HEIGHT = 48

/**
 * A panel's scrolling body. The right padding is the point: on macOS the scrollbar is drawn
 * OVER the content rather than beside it, and with no room reserved it lands on the last column
 * of every row — which in an inspector is the value one is trying to read.
 */
export const PANEL_SCROLL = 'flex min-h-0 flex-1 flex-col overflow-y-auto pr-2'

/**
 * What a row of a list opens onto, drawn UNDER it and inside the list. Indented past the column
 * the chevron stands in, so what a row says lines up with its own name rather than with the edge
 * of the panel — the reading a tree gives its children.
 */
export const ROW_DETAIL = 'flex flex-col pb-1 pl-4'

/**
 * The stacked box a panel puts ABOVE what it acts on — a bar of filters, a message being written.
 * Ruled off rather than spaced: the body scrolls under a boundary, and a gap would let the first
 * row of a list read as part of the controls.
 */
export const PANEL_HEAD = 'border-border flex flex-col gap-2 border-b p-2'

/**
 * The same boundary as `PANEL_HEAD`, drawn across ONE line. The room around it stays with the
 * caller: no two that wear it pad alike.
 */
export const PANEL_BAR = 'border-border flex items-center gap-2 border-b'

/**
 * The body of a titled run of properties, under the heading `PropertySection` folds.
 *
 * No zebra fill, and the reason is the PARITY, not the colour: `nth-child` counts DOM children
 * rather than property lines, so a button row takes a band and unfolding a vector flips everything
 * below it. The contrast half is measured in `tokens.test.ts`.
 */
export const PROPERTY_BODY = 'flex flex-col gap-2 px-2 pt-1 pb-2'

/**
 * A picture standing in a property FIELD — the texture a slot holds, the map a model carries.
 * A picture standing in a ROW is not this: `Row` sizes its own, see `ROW_MEDIA_CONTROL`.
 */
export const FIELD_THUMBNAIL = 'size-(--sc-control)'

/**
 * The box a row keeps for its picture, and the height the line itself measures — paired, because
 * one is the other less `--sc-row-pad`. `Row` picks the pair from what it carries; no caller
 * sizes a row's picture, which is how four sizes and four paddings became one of each.
 */
export const ROW_CONTROL = 'min-h-(--sc-control)'
export const ROW_STACKED = 'min-h-(--sc-row-stacked)'
export const ROW_PICTURE = 'min-h-(--sc-row-media)'

/**
 * The box a row keeps for its picture: the line it stands in, less `--sc-row-pad` top and bottom.
 *
 * 🛑 Two things this line cannot do without, both paid on 2026-08-24. Written out in FULL, three
 * times, never built by a helper: Tailwind scans the source for class names, so a string
 * assembled at runtime generates nothing, the box loses its size, and the picture blows up to
 * its natural width — the whole panel. And the `_` around the minus: CSS `calc` requires
 * whitespace there, and `_` is how Tailwind writes a space inside an arbitrary value.
 *
 * `--sc-row-height` is published by whatever imposes a height (`Collection` does); the fallback
 * is the line's own shape, and getting THAT wrong is what left the model picker at 20px.
 */
const ROW_MEDIA_BOX = 'flex shrink-0 items-center justify-center'

export const ROW_MEDIA_CONTROL = `${ROW_MEDIA_BOX} size-[calc(var(--sc-row-height,var(--sc-control))_-_2*var(--sc-row-pad))]`
export const ROW_MEDIA_STACKED = `${ROW_MEDIA_BOX} size-[calc(var(--sc-row-height,var(--sc-row-stacked))_-_2*var(--sc-row-pad))]`
export const ROW_MEDIA_PICTURE = `${ROW_MEDIA_BOX} size-[calc(var(--sc-row-height,var(--sc-row-media))_-_2*var(--sc-row-pad))]`

/**
 * One property row of an inspector: a label of fixed width, then the control it names.
 *
 * The gap is two, never one: at one the label, the track and the number read as a single
 * run-on string rather than as three things. It is the studio's spacing, applied throughout.
 */
export const FIELD_ROW = 'flex min-h-(--sc-control) min-w-0 items-center gap-2 text-tiny'

/**
 * The room every property line keeps at its end — two controls wide, which is the most any of them
 * asks for. It leans into the panel's own padding so the GLYPHS land on the column the fields end
 * on: a button's box already ends there, but its 14px icon sits centred in a wider square.
 */
export const ROW_ACTIONS =
  'flex w-(--sc-row-actions) shrink-0 items-center justify-end -mr-(--sc-row-action-bleed)'

/**
 * One empty place at the END of that room. Only ever needed there: `justify-end` already puts a
 * lone button on the last place, so a spacer BEFORE one moves nothing.
 */
export const ROW_ACTION_SPACER = 'size-(--sc-control) shrink-0'

/** The hexadecimal a colour swatch is read out as. Published so its guard can import it. */
export const COLOR_READOUT = 'text-muted text-mini min-w-0 flex-1 truncate font-mono uppercase'

/**
 * One width for a whole section, shared with `PropertyRow` so both families of line start on one
 * column. A SHARE of the row, capped and NOT floored: a fixed width truncated in a wide panel, and
 * a floor of eighty overflowed a side zone dragged to its 140px minimum by 21px, measured.
 *
 * The edge is what makes it read as a column rather than a word standing before a control;
 * `PropertyLabel` wears it and stretches, so the rule runs the row's whole height.
 */
export const FIELD_LABEL =
  'text-muted border-border w-(--sc-label-share) max-w-(--sc-label-max) shrink-0 border-r pr-2'

/**
 * The number beside a track — "somewhere past the middle" is not a value anyone can write down.
 * Worn by `Readout`, which is what every track uses; this is here only because it is a shape.
 *
 * Tabular figures are the point: without them the row twitches sideways as the digits change.
 * The width belongs to the style rather than to each caller — a readout that reserves more room
 * takes it off the track beside it, and an inspector ends up stacking sliders of two lengths.
 * Fourteen fits the widest of them, a range's `0–1`.
 */
export const FIELD_READOUT = 'text-muted w-14 shrink-0 text-right tabular-nums'

/**
 * A tick, wherever one is drawn. `accent-accent` is the whole of it and the whole of why this is
 * written once: left off, a checkbox comes out in the browser's own blue — the one colour in the
 * studio that answers to nothing in `index.css`, on the control a reader scans a list for.
 *
 * The size is the caller's: a tick in a property row is bigger than one in a list of files.
 */
export const CHECKBOX = 'accent-accent cursor-pointer'

/** The box a slider is drawn in: the rail sits absolute inside it, the input covers it whole. */
export const SLIDER_TRACK = 'relative h-(--sc-control) min-w-0'

/**
 * That input, stripped of the track the browser would draw with it. The thumb comes from
 * `slider-handle` in `index.css`, a pseudo-element being out of reach of a class written here.
 */
export const SLIDER_HANDLE = 'slider-handle absolute inset-0 m-0 size-full'

/**
 * Both ends of one gesture. Everything a field emits between them is one thing the user did,
 * and whoever owns the value is expected to keep exactly one history entry for it.
 */
export type GestureProps = {
  onGestureStart?: () => void
  onGestureEnd?: () => void
}

/**
 * A value the user types into: the generation form's fields and the inspector's. Its own shape
 * — bordered, tighter corners — because a field is something to fill in, not a bar control.
 */
export const FIELD =
  'bg-surface border-border text-text h-(--sc-control) rounded-(--radius-sc-sm) border px-2'

/**
 * The same field where it takes what the line has left — beside a label, a thumbnail, a dice.
 *
 * `min-w-0` is the half that gets forgotten: a flex child sizes to its content by default, so a
 * long value pushes the row wider than the panel holding it instead of scrolling inside itself.
 *
 * No text size of its own, and that is measured rather than left out: Tailwind's preflight gives
 * a control `font: inherit`, so a field inside a `FIELD_ROW` already reads at the row's size.
 */
export const FIELD_FILL = cn(FIELD, 'min-w-0 flex-1')

/**
 * The surface a menu wears. The SKIN only — never where it sits, and never whether it is raised:
 * a menu that sits IN a form is one of its fields, and a shadow there says it left the page.
 *
 * Its width is left to the caller: a flyout is as wide as its anchor suggests, a menu in a form
 * as wide as the form.
 */
export const MENU_SURFACE = cn(
  'border-border bg-surface flex flex-col gap-0.5',
  'rounded-(--radius-sc-lg) border p-1',
)

/** The same, off the page — for a surface its host places but that reads as floating. */
export const MENU_RAISED = cn(MENU_SURFACE, 'shadow-(--sc-shadow-floating)')

/**
 * The same again, placed by itself, for a menu that HANGS. Above the MODALS (`z-60`), not merely
 * above the panels: measured on the new-document dialog, whose tree came out cut in half behind
 * its own scrim.
 */
export const MENU_FLOATING = cn(MENU_RAISED, 'fixed z-70')

/**
 * Where a workspace's own bar floats over its pane. The image and the 3D space put it in the
 * same corner with the same inset, and a bar that moves has to move in both.
 *
 * The inset only, never the skin: `Toolbar` wears that.
 */
export const PANE_TOOLBAR = 'absolute top-2 left-2'

/**
 * The word a bar sets beside its buttons: which take is loaded, which half of a pair this
 * monitor is, how far along the playhead sits. It answers a question asked OF the bar, so it
 * takes the muted ink rather than the ink of something to reach for.
 *
 * `Timecode` wears it too, under its own figures. The label and the time sit in the same bar,
 * inches apart, and a shade drifting between them would read as two ranks of information where
 * there is one.
 */
export const TOOLBAR_LABEL = 'text-muted text-tiny px-1'

/**
 * The word that divides a LIST into groups — a git stage, the side of a comparison, a set of
 * parameters. Small caps rather than a heavier weight: `PropertySection` takes the weight instead,
 * and the two are a rank apart on purpose, an inspector titling more often than a list does.
 */
export const PANEL_GROUP_LABEL = 'text-muted text-tiny tracking-wide uppercase'

/** The same word sharing its line with a control, which is what asks for the weight as well. */
export const PANEL_GROUP_LABEL_WIDE = cn(PANEL_GROUP_LABEL, 'min-w-0 flex-1 truncate font-medium')

/**
 * The corners a tile cuts, without the plate behind them — for a tile that draws a SHAPE rather
 * than a picture. A folder is the case: a frame bounds a picture that may be pale or transparent,
 * and a silhouette needs no bounding.
 */
export const MEDIA_SHAPE = 'overflow-hidden rounded-(--radius-sc-sm)'

/** The frame every picture sits in, so a tile and a thumbnail cut their corners the same way. */
export const MEDIA_FRAME = `border-border bg-surface border ${MEDIA_SHAPE}`

/**
 * The plate a block of the HOME stands on, and the heading it wears.
 *
 * The home is a page of blocks rather than a dock, so its surface is its own — and it is a
 * surface the two bands had each written out by hand, down to the padding. A third block is what
 * made that a copy.
 */
export const HOME_BLOCK = 'bg-surface flex flex-col gap-2 rounded-(--radius-sc-lg) p-3'

export const HOME_BLOCK_HEADING = 'text-muted text-mini m-0 font-semibold tracking-wider uppercase'

/**
 * The plate a mark sits on in the corner of a tile — never WHICH corner, which is each mark's
 * own business.
 *
 * Two of them share a tile: what an asset IS on one side, where it LIVES on the other. Written
 * once because a picture can be pale, dark or busy under either of them, and one plate drifting
 * from the other would make two answers to the same tile read as two different kinds of thing.
 */
export const TILE_MARK = 'bg-chassis/75 rounded-(--radius-sc-sm) p-px'

/**
 * A control laid over a shelf's artwork — the carousel's arrows, the button a tile puts in its
 * corner. Hidden until the shelf is hovered: a control permanently over the picture hides part
 * of what the shelf exists to show. Gauge, tone and corner stay with the caller.
 *
 * Written once because the groups it reveals itself on are declared by `Carousel` and by
 * `ShelfTile`, and read from files that never import either: a copy of the class is a copy of
 * those names, going stale in silence.
 *
 * Two groups because the same tile is read in both shapes now: a band scrolled sideways on the
 * home, where hovering anywhere in the shelf brings up every corner at once, and a grid in a
 * panel column, which has no carousel around it to hover.
 */
export const SHELF_OVERLAY = cn(
  'border-border bg-panel/90 absolute z-10 flex cursor-pointer items-center justify-center',
  'rounded-full border opacity-0 transition-opacity group-hover/carousel:opacity-100',
  'group-hover/tile:opacity-100',
)

/**
 * How a status reads. The caller names the MEANING — queued, running, cached, failed — and the
 * colour stays here: the jobs bar and the media import both say "this one went wrong", and they
 * must say it in the same red.
 */
export type StatusTone = 'muted' | 'accent' | 'success' | 'warning' | 'danger'

export const TONE_TEXT: Record<StatusTone, string> = {
  muted: 'text-muted',
  // The ink, never the fill: this map only ever paints words, and the fill misses the contrast
  // threshold on all three surfaces a status is read on.
  accent: 'text-accent-ink',
  success: 'text-success',
  // What is waiting on the user, which is neither in flight nor wrong: an approval painted with
  // `accent` read as "running" beside the nodes that really were.
  warning: 'text-warning',
  danger: 'text-danger',
}
