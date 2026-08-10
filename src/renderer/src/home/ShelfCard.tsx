import { UiIcon } from '@/design/UiIcon'
import { BUTTON_BASE } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM } from '@/helpers/tooltip'

/** What one card of a home shelf measures. Read by the spend band, the last one to draw one. */
export const SHELF_CARD_HEIGHT = 84

export type ShelfCardProps = {
  /** Absent for a card that stands for something with no glyph of its own — a model's spend. */
  icon?: string
  title: string
  /** The line under the name — a date, a workspace, two figures. Truncated, never wrapped. */
  subtitle: string
  /** Native tooltip, for a card whose title is cut short. */
  hint?: string
  /** Absent leaves the card inert, as `ShelfTile` already allowed: a spend opens nothing. */
  onClick?: () => void
}

/** The shape both forms draw. Only the hover and the focus ring belong to the pressable one. */
const CARD = 'bg-surface flex size-full flex-col justify-center gap-2 rounded-(--radius-sc-md) px-3'

/**
 * One card of a horizontal shelf: a name, a line underneath, and a glyph when there is one.
 *
 * Three bands had it, twice byte for byte and once redrawn to be rid of the glyph and the click.
 * The spend band is the last of the three left here — the projects and the documents became
 * panels, where a column lists rows rather than a shelf scrolled sideways.
 */
export function ShelfCard({ icon, title, subtitle, hint, onClick }: ShelfCardProps) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        {icon !== undefined && <UiIcon path={icon} size={16} className="text-muted shrink-0" />}
        <span className="text-text truncate text-[12px]">{title}</span>
      </span>
      <span className="text-muted truncate text-[11px]">{subtitle}</span>
    </>
  )

  // A card nothing happens on is not a button: announced as one, it promises an action to a
  // reader who then finds none.
  if (!onClick) {
    return (
      <div {...(hint ? HINT_BOTTOM(hint) : {})} className={CARD}>
        {body}
      </div>
    )
  }

  return (
    // The docks' own button chrome rather than a fourth copy of it — `cn` is `twMerge`, so
    // `CARD`'s column layout wins over the centred row `BUTTON_BASE` assumes.
    <button
      type="button"
      onClick={onClick}
      {...(hint ? HINT_BOTTOM(hint) : {})}
      className={cn(BUTTON_BASE, CARD, 'hover:bg-elevated text-left')}
    >
      {body}
    </button>
  )
}
