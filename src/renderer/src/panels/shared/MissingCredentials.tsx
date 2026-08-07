import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { useSettings } from '@/stores/settings'

/**
 * What a panel shows when the API key is not set, and the way to set it. Written once: a panel
 * that only says what is missing leaves the user hunting for the settings window, and a second
 * copy of this would be a second chance to forget the way out.
 */
export function MissingCredentials({ icon }: { icon: string }) {
  const { t } = useTranslation()
  const openSection = useSettings(state => state.openSection)

  return (
    <EmptyState
      icon={icon}
      message={t('generation.noCredentials')}
      action={{ label: t('auth.configure'), onClick: () => openSection('account') }}
    />
  )
}
