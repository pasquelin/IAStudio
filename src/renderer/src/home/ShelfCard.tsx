import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'

/** What one card of a home shelf measures. Written once so two shelves cannot drift apart. */
export const SHELF_CARD_HEIGHT = 84

export type ShelfCardProps = {
  icon: string
  title: string
  /** The line under the name — a date, a workspace. Truncated, never wrapped. */
  subtitle: string
  /** Native tooltip, for a card whose title is cut short. */
  hint?: string
  onClick: () => void
}

/**
 * One card of a horizontal shelf: a glyph, a name, a line underneath.
 *
 * Shared by the projects and the documents shelves, which had it twice, byte for byte. A third
 * shelf arrives with the next lot; the point of this file is that it will not be a fourth copy.
 */
export function ShelfCard({ icon, title, subtitle, hint, onClick }: ShelfCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={cn(
        'bg-surface hover:bg-elevated flex size-full cursor-pointer flex-col justify-center',
        'gap-1 rounded-(--radius-sc-md) border-none px-3 text-left transition-colors',
        FOCUS_RING,
      )}
    >
      <span className="flex items-center gap-2">
        <UiIcon path={icon} size={16} className="text-muted shrink-0" />
        <span className="text-text truncate text-[12px]">{title}</span>
      </span>
      <span className="text-muted truncate text-[11px]">{subtitle}</span>
    </button>
  )
}
