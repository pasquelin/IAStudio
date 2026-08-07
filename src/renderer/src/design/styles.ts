import { cn } from '@/helpers/cn'

/** The focus ring on its own, for controls that carry their own shape. */
export const FOCUS_RING = 'outline-none focus-visible:ring-accent focus-visible:ring-1'

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

/** One property row of an inspector: a label of fixed width, then the control it names. */
export const FIELD_ROW = 'flex min-w-0 items-center gap-1 text-[11px]'

/** Fixed, so the controls of a section line up rather than each starting where its name ends. */
export const FIELD_LABEL = 'text-muted w-16 shrink-0 truncate'

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
