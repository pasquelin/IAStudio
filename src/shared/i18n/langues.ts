export type Langue = 'fr' | 'en'

export type DefinitionLangue = {
  code: Langue
  /** Nom de la langue dans cette langue — jamais traduit. */
  nom: string
}

export const LANGUES: readonly DefinitionLangue[] = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' },
]

export const LANGUE_PAR_DEFAUT: Langue = 'fr'

export function estLangueSupportee(valeur: string): valeur is Langue {
  return LANGUES.some(langue => langue.code === valeur)
}

/**
 * `app.getLocale()` rend des étiquettes BCP 47 (`fr-CA`, `en-GB`) : seule la sous-étiquette
 * primaire nous intéresse, et une langue non supportée retombe sur le défaut.
 */
export function resoudreLangue(etiquette: string | undefined): Langue {
  const primaire = etiquette?.split('-')[0]?.toLowerCase()
  return primaire && estLangueSupportee(primaire) ? primaire : LANGUE_PAR_DEFAUT
}
