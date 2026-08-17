import { mdiFileOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'

/** What an empty centre shows. */
export function DocumentsHome() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFileOutline} message={t('documents.none')} />
}
