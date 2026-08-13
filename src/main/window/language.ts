import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n'

/**
 * The language every native surface speaks, and the only copy of it. The menu is built once and
 * the About panel registered once, so a surface holding its own copy is how a menu bar and the
 * confirmation dialog under it end up in two different languages.
 *
 * Held here rather than in `menu`, which imports this folder itself.
 */
let current: Language = DEFAULT_LANGUAGE

/** What is rebuilt when the language moves. Native surfaces only: React re-renders on its own. */
const followers = new Set<(language: Language) => void>()

export function setWindowLanguage(language: Language): void {
  if (language === current) return
  current = language
  for (const follow of followers) follow(language)
}

export function windowLanguage(): Language {
  return current
}

/**
 * Rebuilt, not re-read: a surface built once at startup keeps the previous language otherwise,
 * and nothing about it looks wrong until someone switches languages and reads it.
 */
export function followWindowLanguage(follow: (language: Language) => void): () => void {
  followers.add(follow)
  return () => void followers.delete(follow)
}
