import { useEffect } from 'react'
import { initI18n } from '@/i18n'
import { getBridge } from '@/services/bridge'
import { useAppearance } from './useAppearance'

/**
 * The language of everything the renderer draws. Followed rather than derived from the settings:
 * the stored value can be `'system'`, and only the main process resolves that one.
 *
 * Read as well as followed, because `main.tsx` read it before React mounted: a change landing
 * between the two would reach no listener and be lost for the session. `initI18n` is idempotent.
 */
function useLanguage(): void {
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge) return

    // Caught for the same reason as in `main.tsx`: a rejected read must not become an unhandled
    // rejection. Nothing to fall back to here — the first frame already set a language.
    void bridge.window
      .language()
      .then(language => initI18n(language))
      .catch(() => {})
    return bridge.window.onLanguage(language => void initI18n(language))
  }, [])
}

/**
 * Everything a window has to apply to itself from the settings. One entry point rather than a
 * list each window repeats: a second window that published the theme and forgot the language
 * would be a bug nobody notices until someone opens it.
 */
export function useAppliedSettings(): void {
  useAppearance()
  useLanguage()
}
