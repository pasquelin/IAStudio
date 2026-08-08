import { mdiAlertCircleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export type PanelFailureProps = {
  onRetry: () => void
}

// Says nothing about the error itself: the stack is on the console, and it is noise for the
// one person who cannot act on it.
export function PanelFailure({ onRetry }: PanelFailureProps) {
  const { t } = useTranslation()

  return (
    <EmptyState
      icon={mdiAlertCircleOutline}
      message={t('errors.panelCrashed')}
      action={{ label: t('actions.retry'), onClick: onRetry }}
    />
  )
}
