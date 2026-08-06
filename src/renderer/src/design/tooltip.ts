/**
 * Fabrique d'attributs d'infobulle — équivalent du `useTip` de map3D. Retourne les attributs
 * à étaler sur le bouton ; le nom accessible porte le raccourci, qu'il y ait une infobulle
 * ou non : un bouton sans infobulle n'est jamais un bouton sans nom accessible.
 */
export type TooltipFactory = (label: string, shortcut?: string | false) => Record<string, string>

/** Identifiant du `<Tooltip>` partagé, monté une seule fois à la racine. */
export const TOOLTIP_ID = 'sc-tooltip'

export function withShortcut(label: string, shortcut?: string | false): string {
  return shortcut ? `${label} (${shortcut})` : label
}

export function simpleTooltip(place: 'top' | 'right' | 'left' | 'bottom' = 'top'): TooltipFactory {
  return (label, shortcut) => {
    const text = withShortcut(label, shortcut)
    return {
      'aria-label': text,
      'data-tooltip-id': TOOLTIP_ID,
      'data-tooltip-content': text,
      'data-tooltip-place': place,
    }
  }
}
