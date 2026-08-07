import { useEffect } from 'react'
import { effectiveLanguage } from '@shared/i18n/languages'
import { initI18n } from '@/i18n'
import { useSettings } from '@/stores/settings'
import { useAppearance } from './useAppearance'

/**
 * The language of everything the renderer draws. `initI18n` is idempotent — it changes the
 * language on an instance that already exists — so this is safe to run on every change.
 */
function useLanguage(): void {
  const preference = useSettings(state => state.settings.general.language)

  useEffect(() => {
    void initI18n(effectiveLanguage(preference, navigator.language))
  }, [preference])
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
