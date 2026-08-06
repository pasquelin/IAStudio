import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { avecRaccourci, type FabriqueInfobulle } from './infobulle'
import { UiIcon } from './UiIcon'

export type ToolButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'title'
> & {
  /**
   * Chemin d'icône `@mdi/js`. Absent, le bouton n'affiche que ses `children` — pour celui
   * dont l'aperçu EST la valeur qu'il règle, qu'aucun glyphe ne peut dire.
   */
  icone?: string
  /** Nom accessible et contenu de l'infobulle. */
  libelle: string
  /** Fabrique d'infobulle de la barre hôte. Absente, l'`aria-label` reste posé. */
  infobulle?: FabriqueInfobulle
  raccourci?: string | false
  /** Outil en cours d'usage : fond neutre. */
  actif?: boolean
  /** Outil en cours d'usage ET dont la zone a le focus : fond accentué. */
  accentue?: boolean
  tailleIcone?: number
  children?: ReactNode
  /** Le `<button>` lui-même, pour qu'une barre publie son bouton actif comme ancre. */
  ref?: Ref<HTMLButtonElement>
}

/**
 * Bouton d'une barre d'outils : icône, états actif et accentué, nom accessible porteur du
 * raccourci. Source unique du langage des barres — sans lui, chaque site recopiait la classe
 * active, les attributs d'infobulle et la taille d'icône, et un oubli d'`aria-label` passait
 * inaperçu.
 */
export function ToolButton({
  icone,
  libelle,
  infobulle,
  raccourci,
  actif,
  accentue,
  className,
  tailleIcone,
  children,
  ref,
  ...reste
}: ToolButtonProps) {
  const nommage = infobulle
    ? infobulle(libelle, raccourci)
    : { 'aria-label': avecRaccourci(libelle, raccourci) }

  return (
    <button
      type="button"
      ref={ref}
      aria-pressed={actif}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-(--radius-sc-md)',
        'text-texte-attenue size-(--sc-controle) border-none bg-transparent outline-none',
        'hover:bg-elevated hover:text-texte transition-colors',
        'focus-visible:ring-accent focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-40',
        actif && 'bg-elevated text-texte',
        accentue && 'bg-accent hover:bg-accent text-white',
        className,
      )}
      {...nommage}
      {...reste}
    >
      {icone !== undefined && <UiIcon chemin={icone} taille={tailleIcone} />}
      {children}
    </button>
  )
}
