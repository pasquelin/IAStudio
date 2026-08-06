import Icon from '@mdi/react'

export type UiIconProps = {
  /** Chemin `@mdi/js`. */
  chemin: string
  /** Défaut : la taille de contrôle courante, soit 16 px de glyphe. */
  taille?: number
  className?: string
}

/**
 * Unique porte d'entrée des icônes. Aucun SVG inline dans un composant : le jour où la
 * bibliothèque d'icônes change, un seul fichier bouge.
 */
export function UiIcon({ chemin, taille = 16, className }: UiIconProps) {
  return <Icon path={chemin} size={`${taille}px`} className={className} aria-hidden="true" />
}
