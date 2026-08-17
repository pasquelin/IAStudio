import { useEffect } from 'react'
import { initI18n } from '@/i18n'
import { getBridge } from '@/services/bridge'

/**
 * The language of everything the renderer draws. Followed rather than derived from the settings:
 * the stored value can be `'system'`, and only the main process resolves that one.
 *
 * Read as well as followed, because `main.tsx` read it before React mounted: a change landing
 * between the two would reach no listener and be lost for the session. `initI18n` is idempotent.
 */
export function useLanguage(): void {
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
