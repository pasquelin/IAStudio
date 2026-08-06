import Icon from '@mdi/react'

export type UiIconProps = {
  /** Chemin `@mdi/js`. */
  path: string
  /** Défaut : 16 px de glyphe, la convention des barres. */
  size?: number
  className?: string
}

/**
 * Unique porte d'entrée des icônes. Aucun SVG inline dans un composant : le jour où la
 * bibliothèque d'icônes change, un seul fichier bouge.
 */
export function UiIcon({ path, size = 16, className }: UiIconProps) {
  return <Icon path={path} size={`${size}px`} className={className} aria-hidden="true" />
}
