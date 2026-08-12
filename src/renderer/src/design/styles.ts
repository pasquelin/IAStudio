import { cn } from '@/helpers/cn'

/**
 * Class strings shared by more than one component in `design/`. A shape used by a single
 * component stays in that component's file — what lands here is what would otherwise drift
 * apart, and every name here has to be unique across the folder.
 */

/** The focus ring on its own, for controls that carry their own shape. */
export const FOCUS_RING = 'outline-none focus-visible:ring-accent focus-visible:ring-1'

/**
 * The chrome every button of the docks shares, whether it carries a glyph or a label. Its own
 * gauge is left to the caller: `ToolButton` is square, `Button` is as wide as its word.
 */
export const BUTTON_BASE = cn(
  'inline-flex cursor-pointer items-center justify-center rounded-(--radius-sc-md)',
  'border-none transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-40',
  FOCUS_RING,
)

/**
 * The control language shared by the bars: same height token, so the density setting reaches
 * every one of them at once, and the same focus ring, so no bar ends up being the one control
 * a keyboard user cannot see.
 */
export const CONTROL = cn(
  'bg-surface text-text h-(--sc-control) rounded-(--radius-sc-md) text-tiny',
  FOCUS_RING,
)

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
 * Hover, selection and keyboard focus of one line in a list. The same line must not light up
 * differently depending on whether a `Tree` or a `Collection` is holding it.
 */
export function rowSkin(selected: boolean, disabled = false): string {
  // `elevated` is the studio's hover token — what a toolbar button lights up with.
  return cn(
    'rounded-(--radius-sc-sm)',
    // Named, and paired with `data-selected` on the SAME element: `Row` reads both to lift its
    // title and its subtitle out of `muted`, which carries 3.25:1 on `accent-soft` and 3.51 on
    // `elevated` in the dark theme.
    //
    // A refused row takes no group, because its background does not answer a pointer either —
    // and a row that is refused WHILE selected therefore keeps the muted subtitle on
    // `accent-soft`. That case is real (`Models.tsx` can hold a pick the plan no longer allows)
    // and it is left alone knowingly: `opacity-40` is already on it, and WCAG 1.4.3 exempts a
    // disabled control. Lifting the ink there would say the row is available.
    !disabled && 'group/row',
    selected ? 'bg-accent-soft' : 'hover:bg-elevated',
    // After the hover, which it undoes: a refused line that still lights up under the pointer
    // reads as pickable right until the click that does nothing. `MenuRow` reached the same
    // triplet on its own — this is where a list row gets it, so `Tree` inherits it too.
    disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
    FOCUS_RING,
  )
}

/**
 * The quiet ink of a word that lives INSIDE a row — a subtitle, a kind, the help under a tile.
 *
 * `muted` is quiet enough at rest and not enough once the row answers: it carries 3.51:1 on
 * `elevated` and 3.25 on `accent-soft`, both under the 4.5 of WCAG 1.4.3. Raising the token would
 * repaint every dimmed word in the studio, so the word is lifted on those two states instead —
 * read from `rowSkin`'s group, which is why no list has to pass its state down.
 *
 * Written once because five sites had reached the same three classes, one of them twice. A site
 * whose row has no selection carries the selected variant harmlessly: the attribute never appears.
 */
export const ROW_QUIET = cn(
  'text-muted transition-colors',
  'group-hover/row:text-text group-data-selected/row:text-text',
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
    FOCUS_RING,
  )
}

/**
 * `--sc-control` at its tallest, as a number — what `useGauge` falls back on when the gauge
 * cannot be read, and nothing else. No call site passes it any more: three did, each of them
 * right at one density only, and `Collection` now reads the gauge once on their behalf.
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
 * value to write at a call site: `Collection` reads the gauge, and a caller passing a number
 * would go back to being right at one density only.
 */
export const STACKED_ROW_HEIGHT = 36

/**
 * A panel's scrolling body. The right padding is the point: on macOS the scrollbar is drawn
 * OVER the content rather than beside it, and with no room reserved it lands on the last column
 * of every row — which in an inspector is the value one is trying to read.
 */
export const PANEL_SCROLL = 'flex min-h-0 flex-1 flex-col overflow-y-auto pr-2'

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
export const FIELD = cn(
  'bg-surface border-border text-text h-(--sc-control) rounded-(--radius-sc-sm) border px-2',
  FOCUS_RING,
)

/**
 * The surface a menu wears, whether it hangs from a control or opens at the pointer. Its width
 * is left to the caller: a flyout is as wide as its anchor suggests, a context menu wider.
 */
export const MENU_SURFACE = cn(
  'border-border bg-surface fixed z-50 flex flex-col gap-0.5',
  'rounded-(--radius-sc-lg) border p-1 shadow-(--sc-shadow-floating)',
)

/**
 * Where a workspace's own bar floats over its pane. The graph, the image and the 3D space put it
 * in the same corner with the same inset, and a bar that moves has to move in all three.
 *
 * The inset only, never the skin: `Toolbar` wears that. The graph adds a `z-10` of its own —
 * React Flow paints its pane above anything without one, and the other two spaces have nothing
 * to climb over.
 */
export const PANE_TOOLBAR = 'absolute top-2 left-2'

/** The frame every picture sits in, so a tile and a thumbnail cut their corners the same way. */
export const MEDIA_FRAME =
  'border-border bg-surface overflow-hidden rounded-(--radius-sc-sm) border'

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
 * colour stays here: the jobs bar, the media import and a node of the graph all say "this one
 * went wrong", and they must say it in the same red.
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
