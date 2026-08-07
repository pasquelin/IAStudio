import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'

export function Explorer() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiFolderOpenOutline} message={t('project.none')} />
}
