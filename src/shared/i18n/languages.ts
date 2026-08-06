export type Language = 'fr' | 'en'

export type LanguageDefinition = {
  code: Language
  /** Nom de la langue dans cette langue — jamais traduit. */
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
 * `app.getLocale()` rend des étiquettes BCP 47 (`fr-CA`, `en-GB`) : seule la sous-étiquette
 * primaire nous intéresse, et une langue non supportée retombe sur le défaut.
 */
export function resolveLanguage(tag: string | undefined): Language {
  const primary = tag?.split('-')[0]?.toLowerCase()
  return primary && isSupportedLanguage(primary) ? primary : DEFAULT_LANGUAGE
}
