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
 * A button of the status line, of which there are three. Icon-only, each measured 12 x 12 —
 * half of what WCAG 2.2 SC 2.5.8 asks — and only the criterion's spacing exception saved them.
 *
 * The pull-back is what lets the target grow without the line growing under it: the footer has
 * no height of its own, so a control-tall button takes it from 29px to 40 (measured, both ways).
 */
export const STATUS_BUTTON = cn(
  'hover:text-text -my-(--sc-gutter) flex h-(--sc-control) min-w-(--sc-control)',
  'items-center justify-center gap-1.5',
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
 * How loudly a picked row is filled.
 *
 * `soft` is a row PICKED inside a list — one of several a gesture can move through, and the fill
 * has to stay quiet enough that the list is still read as a list. `strong` is a row that says
 * WHERE ONE IS: the project the studio has open, of which there is exactly one and which nothing
 * in the list can move. The difference is not emphasis for its own sake — a soft fill answered the
 * pointer so faintly that the open project was indistinguishable from a hovered one.
 */
export type RowTone = 'soft' | 'strong'

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
 * depending on whether a `Tree` or a `Collection` is holding it.
 *
 * `strong` costs one thing beyond the fill, and it is measured rather than chosen: the ink.
 * Nothing but pure white clears WCAG 1.4.3 on `accent` — the token is pinned at 4.508:1 against
 * white, so `text` at 3.44 does not — hence `data-accented`, which `ROW_INK` and `ROW_QUIET` read
 * to swap BOTH the name and its subtitle to `accent-content`. The size is what keeps the two
 * apart on that fill, since the colour no longer can.
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
  tone?: RowTone
}

export function rowSkin(
  selected: boolean,
  // `row` by default, which is what the function is called: a surface arriving here without a
  // word on the subject is a list until it says otherwise, and a list that quietly took a hover
  // back is the defect this batch went to remove.
  { surface = 'row', disabled, tone }: RowSkin = {},
): string {
  const accented = selected && tone === 'strong'

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
    selected && (accented ? 'bg-accent' : 'bg-accent-soft'),
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
export const ROW_QUIET = cn(
  'text-muted transition-colors',
  'group-data-selected/row:text-text',
  /**
   * On an accent FILL the lift above is not enough: `text` reads 3.44:1 there, and the token is
   * pinned so that only pure white clears 4.5.
   *
   * Written TWICE, and the second spelling is the one that works. Being last in the class string
   * decides nothing — the cascade never reads attribute order — and Tailwind emits the accented
   * rule BEFORE the selected one at equal specificity, so `text` won and this subtitle rendered at
   * 3.44:1 on the open project. Measured in Electron on 13 August, and reproduced by compiling
   * both candidates with the repo's own Tailwind. Stacking the two variants raises the accented
   * rule to (0,3,0) against the lift's (0,2,0), which no emission order can undo.
   *
   * The bare spelling stays for a row accented without being selected, which no surface draws
   * today: `CollectionCell` derives one from the other.
   */
  'group-data-accented/row:text-accent-content',
  'group-data-accented/row:group-data-selected/row:text-accent-content',
)

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

/**
 * The ink of the NAME in a row — the counterpart of `ROW_QUIET`, and it exists for one reason: on
 * a strongly filled row the name has to leave `text` as well, or it sits at 3.44:1 on the accent.
 *
 * At rest it is simply `text`, which is what every row wore before. A site that renders no
 * strongly-filled row carries the variant harmlessly: the attribute never appears.
 */
export const ROW_INK = cn(
  'text-text transition-colors',
  'group-data-accented/row:text-accent-content',
)

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
 * `--sc-row-filled` at its tallest, as a number — the same two steps of text under a fill that
 * stands there rather than one a pointer has to summon, which needs the room that fill takes off
 * them. Goes with `selectionTone: 'strong'`, and only the home asks for either.
 */
export const FILLED_ROW_HEIGHT = 44

/**
 * A panel's scrolling body. The right padding is the point: on macOS the scrollbar is drawn
 * OVER the content rather than beside it, and with no room reserved it lands on the last column
 * of every row — which in an inspector is the value one is trying to read.
 */
export const PANEL_SCROLL = 'flex min-h-0 flex-1 flex-col overflow-y-auto pr-2'

/**
 * The body of a titled run of properties — `PropertyGroup`'s and `PropertySection`'s alike.
 *
 * One string because the inspector shows both, one under the other, and a reader takes them for
 * one panel: a group whose rows touched while a section two boxes down breathed reads as a bug in
 * the panel rather than as two components. They were kept in step by a comment saying "the same
 * gap as", which is what this closes.
 */
export const PROPERTY_BODY = 'flex flex-col gap-2 px-2 pt-1 pb-2'

/**
 * A picture standing in a property line — the texture a slot holds, the map a model carries.
 *
 * One gauge, because a slot is exactly one row tall and three files were each writing it down:
 * two of them with the same sentence explaining why.
 */
export const FIELD_THUMBNAIL = 'size-(--sc-control)'

/**
 * One property row of an inspector: a label of fixed width, then the control it names.
 *
 * The gap is two, never one: at one the label, the track and the number read as a single
 * run-on string rather than as three things. It is the studio's spacing, applied throughout.
 */
export const FIELD_ROW = 'flex min-h-(--sc-control) min-w-0 items-center gap-2 text-tiny'

/**
 * Fixed, so the controls of a section line up rather than each starting where its name ends.
 *
 * The gauge is shared with `PropertyRow`, and that is the whole point: five inspectors out of six
 * draw both families inside one group, so two widths meant two columns of labels in the same box.
 */
export const FIELD_LABEL = 'text-muted w-(--sc-label) shrink-0 truncate'

/**
 * The same label where the field has NO control to line up on that column — a checkbox, which
 * sits at the far end of the row whatever the label does.
 *
 * Held to the fixed gauge, « Projette une ombre » read « Projette une … » at eighty pixels with
 * two thirds of the row empty beside it. Still truncating, and still `title`d for it: a panel
 * narrow enough will run out of room here too, and a label cut mid-word reads as a shorter one
 * that means something else.
 */
export const FIELD_LABEL_WIDE = 'text-muted min-w-0 flex-1 truncate'

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
 * The surface a menu wears, whether it hangs from a control or opens at the pointer. Its width
 * is left to the caller: a flyout is as wide as its anchor suggests, a context menu wider.
 */
export const MENU_SURFACE = cn(
  'border-border bg-surface fixed z-50 flex flex-col gap-0.5',
  'rounded-(--radius-sc-lg) border p-1 shadow-(--sc-shadow-floating)',
)

/**
 * Where a workspace's own bar floats over its pane. The image and the 3D space put it in the
 * same corner with the same inset, and a bar that moves has to move in both.
 *
 * The inset only, never the skin: `Toolbar` wears that.
 */
export const PANE_TOOLBAR = 'absolute top-2 left-2'

/** The frame every picture sits in, so a tile and a thumbnail cut their corners the same way. */
export const MEDIA_FRAME =
  'border-border bg-surface overflow-hidden rounded-(--radius-sc-sm) border'

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
