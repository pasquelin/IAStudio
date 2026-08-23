import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { failureMessageKey } from '@/services/failureMessage'
import { providerOf } from '@shared/domain/account'
import { accountsByProvider, useAccounts } from '@/stores/accounts'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { useSettings } from '@/stores/settings'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL } from '@/design/windowStyles'
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
  const groups = accountsByProvider(accounts)

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {accounts.length === 0 ? (
        <p className={WINDOW_CAPTION}>{t('accounts.none')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map(group => (
            <li key={group.providerId}>
              <h4 className={WINDOW_GROUP_LABEL}>{t(`aiClouds.${group.providerId}`)}</h4>
              <ul className="flex flex-col gap-2">
                {group.accounts.map(account => (
                  <AccountSettingsRow
                    key={account.id}
                    account={account}
                    authenticated={auth.authenticated}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {!auth.authenticated && accounts.some(account => providerOf(account) === SCENARIO_CLOUD) && (
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
