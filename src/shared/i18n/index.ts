import en from './en.json'
import fr from './fr.json'
import type { Language } from './languages'

/**
 * Les traductions vivent dans `shared/` : le menu natif est construit par le main, l'UI
 * par le renderer, et les deux doivent dire la même chose. Un fichier JSON par langue.
 */
export const TRANSLATIONS: Record<Language, typeof fr> = { fr, en }

export type Translations = typeof fr

export * from './languages'
