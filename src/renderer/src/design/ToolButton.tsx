import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { withShortcut, type TooltipFactory } from './tooltip'
import { UiIcon } from './UiIcon'

export type ToolButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'title'
> & {
  /**
   * Chemin d'icône `@mdi/js`. Absent, le bouton n'affiche que ses `children` — pour celui
   * dont l'aperçu EST la valeur qu'il règle, qu'aucun glyphe ne peut dire.
   */
  icon?: string
  /** Nom accessible et contenu de l'infobulle. */
  label: string
  /** Fabrique d'infobulle de la barre hôte. Absente, l'`aria-label` reste posé. */
  tooltip?: TooltipFactory
  shortcut?: string | false
  /** Outil en cours d'usage : fond neutre. */
  active?: boolean
  /** Outil en cours d'usage ET dont la zone a le focus : fond accentué. */
  accented?: boolean
  iconSize?: number
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
  icon,
  label,
  tooltip,
  shortcut,
  active,
  accented,
  className,
  iconSize,
  children,
  ref,
  ...rest
}: ToolButtonProps) {
  const naming = tooltip
    ? tooltip(label, shortcut)
    : { 'aria-label': withShortcut(label, shortcut) }

  return (
    <button
      type="button"
      ref={ref}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-(--radius-sc-md)',
        'text-muted size-(--sc-control) border-none bg-transparent outline-none',
        'hover:bg-elevated hover:text-text transition-colors',
        'focus-visible:ring-accent focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-elevated text-text',
        accented && 'bg-accent hover:bg-accent text-white',
        className,
      )}
      {...naming}
      {...rest}
    >
      {icon !== undefined && <UiIcon path={icon} size={iconSize} />}
      {children}
    </button>
  )
}
