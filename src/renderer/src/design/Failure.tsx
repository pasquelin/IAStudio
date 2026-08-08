import { mdiAlertCircleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './EmptyState'

export type FailureProps = {
  scope: 'panel' | 'window'
  onRetry: () => void
}

// A function component because `ErrorBoundary` is a class and cannot reach `useTranslation`.
// Says nothing of the error itself: the stack is on the console, and it is noise for the one
// person who cannot act on it.
export function Failure({ scope, onRetry }: FailureProps) {
  const { t } = useTranslation()

  return (
    <EmptyState
      icon={mdiAlertCircleOutline}
      message={t(scope === 'panel' ? 'errors.panelCrashed' : 'errors.windowCrashed')}
      action={{ label: t('actions.retry'), onClick: onRetry }}
    />
  )
}
