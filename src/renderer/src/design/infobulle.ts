/**
 * Fabrique d'attributs d'infobulle d'une barre — équivalent du `useTip` de map3D.
 * Retourne les attributs à étaler sur le bouton ; le nom accessible porte le raccourci,
 * qu'il y ait une infobulle ou non.
 */
export type FabriqueInfobulle = (
  libelle: string,
  raccourci?: string | false,
) => Record<string, string>

export function avecRaccourci(libelle: string, raccourci?: string | false): string {
  return raccourci ? `${libelle} (${raccourci})` : libelle
}

export function infobulleSimple(): FabriqueInfobulle {
  return (libelle, raccourci) => {
    const texte = avecRaccourci(libelle, raccourci)
    return { 'aria-label': texte, title: texte }
  }
}
