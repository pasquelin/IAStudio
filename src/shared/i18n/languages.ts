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

export const DEFAULT_LANGUAGE: Language = 'fr'

export function isSupportedLanguage(value: string): value is Language {
  return LANGUAGES.some(language => language.code === value)
}

/**
 * `app.getLocale()` returns BCP 47 tags (`fr-CA`, `en-GB`): only the primary subtag matters,
 * and an unsupported language falls back to the default.
 */
export function resolveLanguage(tag: string | undefined): Language {
  const primary = tag?.split('-')[0]?.toLowerCase()
  return primary && isSupportedLanguage(primary) ? primary : DEFAULT_LANGUAGE
}
