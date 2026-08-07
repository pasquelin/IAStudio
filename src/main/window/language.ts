import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n'

/**
 * The language the windows speak, for the few native surfaces built outside the menu — a
 * confirmation before closing, say. Held here rather than imported from `menu`, which imports
 * this folder itself.
 */
let current: Language = DEFAULT_LANGUAGE

export function setWindowLanguage(language: Language): void {
  current = language
}

export function windowLanguage(): Language {
  return current
}
