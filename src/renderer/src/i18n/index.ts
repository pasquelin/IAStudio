import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LANGUAGE, TRANSLATIONS, type Language } from '@shared/i18n'

const NAMESPACE = 'studio'

export async function initI18n(language: Language = DEFAULT_LANGUAGE): Promise<void> {
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

export async function changeLanguage(language: Language): Promise<void> {
  await i18next.changeLanguage(language)
}
