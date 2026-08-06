import Icon from '@mdi/react'

export type UiIconProps = {
  /** `@mdi/js` path. */
  path: string
  /** Defaults to a 16 px glyph, the convention across bars. */
  size?: number
  className?: string
}

/**
 * The single entry point for icons. No inline SVG in a component: the day the icon library
 * changes, only one file moves.
 */
export function UiIcon({ path, size = 16, className }: UiIconProps) {
  return <Icon path={path} size={`${size}px`} className={className} aria-hidden="true" />
}
