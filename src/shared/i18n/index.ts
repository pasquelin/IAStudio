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

/**
 * A bundle line with its `{{holes}}` filled, for the side that has no i18next.
 *
 * EVERY occurrence of each hole — a sentence may name the same value twice, and the four sites
 * this replaces used `String.replace` with a literal, which rewrites the FIRST match only.
 *
 * A hole nothing names is left standing rather than blanked: nothing here can tell a forgotten
 * argument from a value that is legitimately absent, and a sentence with a gap in it reads as
 * finished. `main/no-unfilled-placeholder.test.ts` says what stands guard over that.
 *
 * NOT i18next, and the gap is measured: a hole carrying a format — `{{count, number}}` and
 * `{{value, number(maximumFractionDigits: 1)}}`, 14 occurrences on 2026-08-15 — is left whole,
 * because filling it without formatting would print a raw number where the window prints a
 * grouped one. Every one of those lives in a section only the window reads. A hole named with a
 * dot or a dash is left whole for the same reason: no bundle writes one, and guessing is worse
 * than standing out.
 */
export function fillHoles(sentence: string, values: Record<string, string | number>): string {
  return sentence.replace(/\{\{(\w+)\}\}/g, (hole, name: string) =>
    // `hasOwn`, not `in`: `in` walks the prototype chain, and `{{toString}}` would print a
    // function's source into a sentence. Measured, before it was written this way.
    Object.hasOwn(values, name) ? String(values[name]) : hole,
  )
}

export * from './languages'
export * from './model-text'
export * from './pseudo'
