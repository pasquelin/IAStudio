import { mdiAlertCircleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export type WindowFailureProps = {
  onRetry: () => void
}

// The last thing standing when the shell itself fails, so it leans on nothing above it.
export function WindowFailure({ onRetry }: WindowFailureProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-chassis h-screen w-screen">
      <EmptyState
        icon={mdiAlertCircleOutline}
        message={t('errors.windowCrashed')}
        action={{ label: t('actions.retry'), onClick: onRetry }}
      />
    </div>
  )
}
