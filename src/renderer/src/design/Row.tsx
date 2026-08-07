import type { ReactNode } from 'react'
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
  /** Struck through and dimmed: a hidden layer, an invisible mesh. */
  muted?: boolean
}

/**
 * One line, everywhere. Written once so the model browser, the layer stack, the mesh and light
 * panels and the outliner share a height, a rhythm and a truncation instead of drifting apart.
 *
 * It paints no background: selection and hover belong to whatever list holds it — `Collection`
 * does it in its cell, and a background set here would sit on top and swallow it.
 */
export function Row({ media, icon, title, subtitle, leading, actions, muted }: RowProps) {
  return (
    <div className="flex h-full items-center gap-2 px-1">
      {leading}
      {media ?? (icon && <UiIcon path={icon} size={14} className="shrink-0" />)}
      <div className="min-w-0 flex-1 leading-tight">
        {/* Titled with its own name: the row truncates, and a truncated name is exactly the
            case where hovering is the only way to read it. */}
        <p
          title={title}
          className={`truncate text-[12px] ${muted ? 'text-muted line-through' : 'text-text'}`}
        >
          {title}
        </p>
        {subtitle && <p className="text-muted truncate text-[10px]">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
