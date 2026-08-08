import { mdiAlertCircleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export type PanelFailureProps = {
  onRetry: () => void
}

/**
 * What a panel shows once its content has thrown. Deliberately says nothing about the error:
 * the message is on the console with its component stack, and a stack in a dock is noise for
 * the one person who cannot act on it.
 */
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
