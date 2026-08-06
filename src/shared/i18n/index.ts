import en from './en.json'
import fr from './fr.json'
import type { Langue } from './langues'

/**
 * Les traductions vivent dans `shared/` : le menu natif est construit par le main, l'UI
 * par le renderer, et les deux doivent dire la même chose. Un fichier JSON par langue.
 */
export const TRADUCTIONS: Record<Langue, typeof fr> = { fr, en }

export type Traductions = typeof fr

export * from './langues'
