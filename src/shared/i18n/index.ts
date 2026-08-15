import { isRecord } from '../guards'
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

/**
 * A bundle line in English, looked up by a key composed at runtime.
 *
 * English on purpose, and that is the whole reason this exists: what it serves is read by the
 * assistant's model, which reasons in English — the same catalogue or the same refusal read in
 * French would change what it decides from one user to the next. Anything bound for a screen
 * goes through `useTranslation` in the window, or `TRANSLATIONS[language]` in the main process.
 *
 * Both sides ask: the main process composes the instruction, the window composes the history of
 * what it did. `''` for a key nothing names, rather than the key itself — this text lands inside
 * a sentence written for a model, where a raw key reads as an instruction it cannot follow.
 */
export function englishText(key: string): string {
  const text = key
    .split('.')
    .reduce<unknown>(
      (current, part) => (isRecord(current) ? current[part] : undefined),
      TRANSLATIONS.en,
    )
  return typeof text === 'string' ? text : ''
}

export * from './languages'
export * from './model-text'
export * from './pseudo'
