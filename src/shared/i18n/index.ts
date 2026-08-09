import en from './en.json'
import fr from './fr.json'
import type { Language } from './languages'

/**
 * Translations live in `shared/`: the native menu is built by the main process and the UI by
 * the renderer, and both must say the same thing. One JSON file per language.
 */
export const TRANSLATIONS: Record<Language, typeof fr> = { fr, en }

export type Translations = typeof fr

export * from './languages'
export * from './model-text'
