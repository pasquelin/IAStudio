import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, TRANSLATIONS, type Language } from '@shared/i18n'

const NAMESPACE = 'studio'

/**
 * What the document says it is written in. A screen reader picks its voice from it, so an
 * English interface under `lang="fr"` is read with French phonetics — `index.html` shipped the
 * attribute hardcoded, and it was wrong for every user who did not run the studio in French.
 */
function declareLanguage(language: Language): void {
  document.documentElement.lang = language
}

export async function initI18n(language: Language = DEFAULT_LANGUAGE): Promise<void> {
  declareLanguage(language)

  if (i18next.isInitialized) {
    await i18next.changeLanguage(language)
    return
  }

  await i18next.use(initReactI18next).init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: NAMESPACE,
    ns: [NAMESPACE],
    resources: {
      fr: { [NAMESPACE]: TRANSLATIONS.fr },
      en: { [NAMESPACE]: TRANSLATIONS.en },
    },
    interpolation: { escapeValue: false },
  })
}
