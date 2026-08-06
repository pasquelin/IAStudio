import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EtatVide } from './EtatVide'

export function Explorateur() {
  const { t } = useTranslation()
  return <EtatVide icone={mdiFolderOpenOutline} message={t('projet.aucun')} />
}
