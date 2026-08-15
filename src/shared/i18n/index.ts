import { en } from './en'
import { fr } from './fr'
import type { Language } from './languages'

/**
 * Translations live in `shared/`: the native menu is built by the main process and the UI by
 * the renderer, and both must say the same thing. One directory of sections per language,
 * merged by that directory's index — see `fr/index.ts` for why the storage is split.
 */
export const TRANSLATIONS: Record<Language, typeof fr> = { fr, en }

export type { Translations } from './fr'

export * from './languages'
export * from './model-text'
export * from './pseudo'
