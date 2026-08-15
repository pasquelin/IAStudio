import { DEFAULT_LANGUAGE, type Language } from '@shared/i18n'
import { log } from '@main/log'

/**
 * The language every native surface speaks, and the only copy of it. Held here rather than in
 * `menu`, which imports this folder itself.
 */
let current: Language = DEFAULT_LANGUAGE

const followers = new Set<(language: Language) => void>()

export function setWindowLanguage(language: Language): void {
  if (language === current) return
  current = language

  for (const follow of followers) {
    // One surface failing must not keep its neighbours from the change, nor the settings
    // broadcast that runs after this call — every window would stay on the previous language.
    try {
      follow(language)
    } catch (error) {
      log.error('window', `a native surface did not follow the language: ${String(error)}`)
    }
  }
}

export function windowLanguage(): Language {
  return current
}

/**
 * For the surfaces built once — the menu bar, the About panel — which would otherwise keep the
 * language they were built in. Everything else reads `windowLanguage()` when it draws.
 */
export function followWindowLanguage(follow: (language: Language) => void): void {
  followers.add(follow)
}
