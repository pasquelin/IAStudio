import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { ROW_INK, ROW_QUIET } from './styles'
import { TIP_RIGHT, type TooltipFactory } from '@/helpers/tooltip'
import { UiIcon } from './UiIcon'

export type RowProps = {
  /** A thumbnail, when the row has a picture. Wins over `icon` when both are given. */
  media?: ReactNode
  /** `@mdi/js` path, for rows whose kind is what identifies them. */
  icon?: string
  title: string
  subtitle?: string
  /** Before the visual: the visibility eye of a layer or a node. */
  leading?: ReactNode
  /** After the title, pushed to the end. */
  actions?: ReactNode
  /** Struck through, and dimmed AT REST only: a hidden layer, an invisible mesh. */
  muted?: boolean
  /**
   * A sentence added under the name in its tooltip — why the row is refused, typically. The
   * name is already on screen, so this EXPLAINS rather than repeats: that is what the factory's
   * `description` is for, and a tooltip that echoes a visible word is noise to a screen reader.
   */
  hint?: string
  /** Placement of the name's tooltip. Rows live in side panels, so it goes right by default. */
  tip?: TooltipFactory
}

/**
 * One line, everywhere. Written once so the model browser, the layer stack, the mesh and light
 * panels and the outliner share a height, a rhythm and a truncation instead of drifting apart.
 *
 * It paints no background: selection and hover belong to whatever list holds it — `Collection`
 * does it in its cell, and a background set here would sit on top and swallow it.
 */
export function Row({
  media,
  icon,
  title,
  subtitle,
  leading,
  actions,
  muted,
  hint,
  tip = TIP_RIGHT,
}: RowProps) {
  return (
    // One step, and the cell that PAINTS the fill adds the second — `Collection`'s cell and the
    // tree's row both do. Raised to two here once, for a name touching its own highlight in the
    // projects: inside a tree that stacked on the row's own step and pushed every name a further
    // 4px off its chevron, in a panel whose rows are not filled at all.
    <div className="flex h-full items-center gap-2 px-1">
      {leading}
      {media ?? (icon && <UiIcon path={icon} size={14} className="shrink-0" />)}
      <div className="min-w-0 flex-1 leading-tight">
        {/* Tipped with its own name: the row truncates, and a truncated name is exactly the
            case where hovering is the only way to read it. The studio tooltip and not `title`,
            which comes with the OS delay and none of the theme. */}
        <p
          {...tip(title, false, hint)}
          className={cn(
            'truncate text-xs leading-tight',
            // A hidden layer is DIMMED, not disabled: a layer is still selected and renamed, a
            // scene node still selected and dragged, so the exemption WCAG 1.4.3 grants a disabled
            // control does not cover either. Lifted on the same two states as the subtitle below —
            // 3.51:1 on `elevated`, 3.25 on `accent-soft` — and the strike-through, with the
            // crossed-out eye beside it, is what goes on saying the row is hidden.
            muted ? cn(ROW_QUIET, 'line-through') : ROW_INK,
          )}
        >
          {title}
        </p>
        {/* Muted at rest, full ink once the row is picked or pointed at: `muted` on
            `accent-soft` reads 3.25:1 and on `elevated` 3.51, both under the 4.5 of WCAG 1.4.3.
            Driven from the row through `rowSkin`'s group, so no list has to pass its state down. */}
        {subtitle && <p className={cn(ROW_QUIET, 'text-mini truncate')}>{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
