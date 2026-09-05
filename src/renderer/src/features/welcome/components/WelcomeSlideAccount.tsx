import { useTranslation } from 'react-i18next'
import { WINDOW_CAPTION } from '@/components/windowStyles'
import { AccountSettingsAddForm } from '@/features/settings/components/AccountSettings/AccountSettingsAddForm'
import { useAccounts } from '@/stores/accounts'
import { WelcomeCopy } from './WelcomeCopy'

export function WelcomeSlideAccount() {
  const { t } = useTranslation()
  const accounts = useAccounts(state => state.accounts)

  return (
    <div className="max-w-lg">
      <WelcomeCopy title={t('welcome.account.title')} body={t('welcome.account.body')} />
      {accounts.length > 0 ? (
        <p className={WINDOW_CAPTION}>{t('welcome.account.connected')}</p>
      ) : null}
      <AccountSettingsAddForm />
    </div>
  )
}
