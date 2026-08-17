import { mdiFileOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'

export function DocumentsLoading() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('collection.loading')} />
}
