import { mdiCloudOutline, mdiCogOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuRow } from '@/design/MenuRow'
import { Separator } from '@/design/Separator'
import { TitleBarSelect } from '@/design/TitleBarSelect'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { activeAccount, useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'

/**
 * Switches which stored API key the studio calls with.
 *
 * A switch, never a form: keys are typed in the settings alone. And a switch of accounts only,
 * not of projects — an API key carries its own Scenario project, which the API exposes no way
 * to list or to choose. What it changes is the remote library; the open local project is the
 * user's disk and stays exactly as it is, and `ProjectSelect` beside it is what moves that.
 */
export function AccountSelect() {
  const { t } = useTranslation()

  const accounts = useAccounts(state => state.accounts)
  const activate = useAccounts(state => state.activate)
  const authenticated = useSettings(state => state.auth.authenticated)
  const openSection = useSettings(state => state.openSection)

  const active = activeAccount(accounts)
  const manage = (): void => openSection('account')

  const name = active?.name ?? t('accounts.notConnected')

  return (
    <TitleBarSelect
      leading={
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            authenticated ? 'bg-success' : 'bg-muted',
          )}
        />
      }
      label={name}
      // The name CONTAINS what the eye reads (WCAG 2.5.3). It said « Compte Scenario » alone
      // until 12 August, so the button answered to a phrase written nowhere on it — and someone
      // driving by voice could not ask for the account whose name they were looking at.
      name={t('accounts.switch', { name })}
      hint={t('accounts.switchHint')}
      // One row per account, plus the way out to the settings. With no account that leaves a
      // single row, and `TitleBarSelect` rightly refuses to call one row a menu: the button acts
      // directly instead, which is the one thing left to do anyway.
      rowCount={accounts.length + 1}
      width="max-w-44"
      onAct={manage}
      rows={close => (
        <>
          {accounts.map(account => (
            <MenuRow
              key={account.id}
              label={account.name}
              icon={mdiCloudOutline}
              checked={account.active}
              tick="one-of"
              tip={HINT_RIGHT(t('accounts.useHint'))}
              onSelect={() => {
                close()
                void activate(account.id)
              }}
            />
          ))}

          {accounts.length > 0 && <Separator orientation="horizontal" className="self-center" />}

          <MenuRow
            label={t('accounts.manage')}
            icon={mdiCogOutline}
            tip={HINT_RIGHT(t('accounts.manageHint'))}
            onSelect={() => {
              close()
              manage()
            }}
          />
        </>
      )}
    />
  )
}
