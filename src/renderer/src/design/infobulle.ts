/**
 * Fabrique d'attributs d'infobulle — équivalent du `useTip` de map3D. Retourne les attributs
 * à étaler sur le bouton ; le nom accessible porte le raccourci, qu'il y ait une infobulle
 * ou non : un bouton sans infobulle n'est jamais un bouton sans nom accessible.
 */
export type FabriqueInfobulle = (
  libelle: string,
  raccourci?: string | false,
) => Record<string, string>

/** Identifiant du `<Tooltip>` partagé, monté une seule fois à la racine. */
export const ID_INFOBULLE = 'sc-infobulle'

export function avecRaccourci(libelle: string, raccourci?: string | false): string {
  return raccourci ? `${libelle} (${raccourci})` : libelle
}

export function infobulleSimple(
  place: 'top' | 'right' | 'left' | 'bottom' = 'top',
): FabriqueInfobulle {
  return (libelle, raccourci) => {
    const texte = avecRaccourci(libelle, raccourci)
    return {
      'aria-label': texte,
      'data-tooltip-id': ID_INFOBULLE,
      'data-tooltip-content': texte,
      'data-tooltip-place': place,
    }
  }
}
