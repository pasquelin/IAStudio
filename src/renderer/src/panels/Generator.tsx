import { mdiCreationOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export function Generator() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiCreationOutline} message={t('generation.noModel')} />
}
