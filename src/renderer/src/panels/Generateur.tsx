import { mdiCreationOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EtatVide } from './EtatVide'

export function Generateur() {
  const { t } = useTranslation()
  return <EtatVide icone={mdiCreationOutline} message={t('generation.aucunModele')} />
}
