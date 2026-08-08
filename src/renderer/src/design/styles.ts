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
  'bg-surface text-text h-(--sc-control) rounded-(--radius-sc-md) text-[11px]',
  FOCUS_RING,
)

/**
 * Hover, selection and keyboard focus of one line in a list. The same line must not light up
 * differently depending on whether a `Tree` or a `Collection` is holding it.
 */
export function rowSkin(selected: boolean): string {
  // `elevated` is the studio's hover token — what a toolbar button lights up with.
  return cn(
    'rounded-(--radius-sc-sm)',
    selected ? 'bg-accent-soft' : 'hover:bg-elevated',
    FOCUS_RING,
  )
}

/**
 * A labelled toggle: the shape buttons of a texture, the view modes of a sky, the filters of
 * the journal. Written once because three surfaces had it, and the third had already drifted —
 * it lit up in `accent-soft` where the others use `elevated`, the studio's hover token.
 */
export function chipSkin(active: boolean): string {
  return cn(
    'h-(--sc-control) cursor-pointer rounded-(--radius-sc-sm) border-none px-2 text-xs',
    active ? 'bg-elevated text-text' : 'text-muted hover:text-text bg-transparent',
    FOCUS_RING,
  )
}

/**
 * What one line measures in a list whose rows are the height of a control — `--sc-control` at
 * its tallest. The virtualizer needs a number and cannot read the gauge, so the lists estimating
 * such a row read it from here rather than each carrying its own copy of 28. A list whose rows
 * hold more than a line of text (the model browser) sizes itself and does not read this.
 */
export const LIST_ROW_HEIGHT = 28

/** One property row of an inspector: a label of fixed width, then the control it names. */
export const FIELD_ROW = 'flex min-w-0 items-center gap-1 text-[11px]'

/** Fixed, so the controls of a section line up rather than each starting where its name ends. */
export const FIELD_LABEL = 'text-muted w-16 shrink-0 truncate'

/**
 * The number beside a slider — "somewhere past the middle" is not a value anyone can write down.
 *
 * Tabular figures are the point: without them the row twitches sideways as the digits change. The
 * width is the caller's, one value being narrower than a span of two.
 */
export const FIELD_READOUT = 'text-muted shrink-0 text-right tabular-nums'

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

/** The frame every picture sits in, so a tile and a thumbnail cut their corners the same way. */
export const MEDIA_FRAME =
  'border-border bg-surface overflow-hidden rounded-(--radius-sc-sm) border'
