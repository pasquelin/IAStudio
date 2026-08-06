import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type FooterProps = {
  /** Fil d'Ariane : projet, document courant. */
  gauche?: ReactNode
  /** Compteurs et indicateurs — connexion, tâches, mémoire. */
  droite?: ReactNode
}

/**
 * Ligne d'état, en pied de fenêtre. Elle occupe toute la largeur, sous les rails : ce qui
 * s'y affiche vaut pour l'application entière, pas pour un panneau.
 */
export function Footer({ gauche, droite }: FooterProps) {
  const { t } = useTranslation()

  return (
    <footer className="text-texte-attenue flex h-6 shrink-0 items-center gap-3 px-4 text-[11px]">
      <span className="truncate">{gauche ?? t('projet.aucun')}</span>
      <span className="ml-auto flex shrink-0 items-center gap-3">{droite}</span>
    </footer>
  )
}
