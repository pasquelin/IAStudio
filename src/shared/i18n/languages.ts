export type Language = 'fr' | 'en'

export type LanguageDefinition = {
  code: Language
  /** The language's name in that language — never translated. */
  name: string
}

export const LANGUAGES: readonly LanguageDefinition[] = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
]

/**
 * The bundle everything else falls back to: the reference, and the fullest — a key missing
 * from another language is read from this one rather than shown as itself.
 *
 * Not the same decision as `UNKNOWN_SYSTEM_LANGUAGE` below, which is why they are two.
 */
export const DEFAULT_LANGUAGE: Language = 'fr'

/**
 * What a machine set to neither language is served. English, because a reader whose system is
 * in German, Spanish or Japanese is far likelier to read it than French — and because the
 * alternative asks them to find the settings, written in French, to discover English exists.
 */
export const UNKNOWN_SYSTEM_LANGUAGE: Language = 'en'

/** What the setting holds: a language, or a deferral to whatever the machine is set to. */
export type LanguagePreference = Language | 'system'

export const LANGUAGE_PREFERENCES: readonly LanguagePreference[] = [
  'system',
  ...LANGUAGES.map(language => language.code),
]

export function isSupportedLanguage(value: string): value is Language {
  return LANGUAGES.some(language => language.code === value)
}

/**
 * `app.getLocale()` returns BCP 47 tags (`fr-CA`, `en-GB`): only the primary subtag matters,
 * and a language nothing is translated into is served English.
 */
export function resolveLanguage(tag: string | undefined): Language {
  const primary = tag?.split('-')[0]?.toLowerCase()
  return primary && isSupportedLanguage(primary) ? primary : UNKNOWN_SYSTEM_LANGUAGE
}

/**
 * The language actually in force. Both processes go through this: the main builds the native
 * menu and the native dialogs, the renderer builds everything else, and a machine tag read on
 * one side only is how a menu ends up in a different language from the window under it.
 */
export function effectiveLanguage(
  preference: LanguagePreference,
  machineTag: string | undefined,
): Language {
  return preference === 'system' ? resolveLanguage(machineTag) : preference
}
