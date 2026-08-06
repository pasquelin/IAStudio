import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGUE_PAR_DEFAUT, TRADUCTIONS, type Langue } from '@shared/i18n'

const NAMESPACE = 'studio'

export async function initialiserI18n(langue: Langue = LANGUE_PAR_DEFAUT): Promise<void> {
  if (i18next.isInitialized) {
    await i18next.changeLanguage(langue)
    return
  }

  await i18next.use(initReactI18next).init({
    lng: langue,
    fallbackLng: LANGUE_PAR_DEFAUT,
    defaultNS: NAMESPACE,
    ns: [NAMESPACE],
    resources: {
      fr: { [NAMESPACE]: TRADUCTIONS.fr },
      en: { [NAMESPACE]: TRADUCTIONS.en },
    },
    interpolation: { escapeValue: false },
  })
}

export async function changerLangue(langue: Langue): Promise<void> {
  await i18next.changeLanguage(langue)
}
