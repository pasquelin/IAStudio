import { mdiProgressClock } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export function Jobs() {
  const { t } = useTranslation()
  return <EmptyState icon={mdiProgressClock} message={t('jobs.none')} />
}
