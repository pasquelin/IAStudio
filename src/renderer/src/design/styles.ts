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
 * A value the user types into: the generation form's fields and the inspector's. Its own shape
 * — bordered, tighter corners — because a field is something to fill in, not a bar control.
 */
export const FIELD = cn(
  'bg-surface border-border text-text h-(--sc-control) rounded-(--radius-sc-sm) border px-2',
  FOCUS_RING,
)
