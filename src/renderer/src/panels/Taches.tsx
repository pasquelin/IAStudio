import { mdiProgressClock } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EtatVide } from './EtatVide'

export function Taches() {
  const { t } = useTranslation()
  return <EtatVide icone={mdiProgressClock} message={t('taches.aucune')} />
}
