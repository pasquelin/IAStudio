import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { failureMessageKey } from '@/services/failure-message'
import { useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'
import { WINDOW_CAPTION } from '@/design/window-styles'
import { AccountSettingsAddForm } from './AccountSettingsAddForm'
import { AccountSettingsRow } from './AccountSettingsRow'

/**
 * The stored API keys. DaisyUI rather than the in-house design system: this is a surface where
 * the studio becomes an application again — see CLAUDE.md.
 *
 * The only place a key is ever typed. Switching between saved accounts happens in the header;
 * what is typed here is never read back, so the fields are cleared even on success.
 */
export function AccountSettings() {
  const { t } = useTranslation()

  const auth = useSettings(state => state.auth)
  const refreshAuth = useSettings(state => state.refreshAuth)
  const accounts = useAccounts(state => state.accounts)

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {accounts.length === 0 ? (
        <p className={WINDOW_CAPTION}>{t('accounts.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map(account => (
            <AccountSettingsRow
              key={account.id}
              account={account}
              authenticated={auth.authenticated}
            />
          ))}
        </ul>
      )}

      {!auth.authenticated && accounts.length > 0 && (
        <p role="alert" className="text-error text-xs">
          {t(failureMessageKey(auth.reason))}
        </p>
      )}

      <AccountSettingsAddForm />

      <p className={WINDOW_CAPTION}>{t('accounts.explanation')}</p>
      <p className={WINDOW_CAPTION}>{t('auth.explanation')}</p>
    </div>
  )
}
