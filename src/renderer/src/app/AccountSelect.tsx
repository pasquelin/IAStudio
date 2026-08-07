import { mdiChevronDown, mdiCloudOutline, mdiCogOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flyout } from '@/design/Flyout'
import { MenuRow } from '@/design/MenuRow'
import { Separator } from '@/design/Separator'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { activeAccount, useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'

/**
 * Switches which stored API key the studio calls with.
 *
 * A switch, never a form: keys are typed in the settings alone. And a switch of accounts only,
 * not of projects — an API key carries its own Scenario project, which the API exposes no way
 * to list or to choose. What it changes is the remote library; the open local project is the
 * user's disk and stays exactly as it is.
 */
export function AccountSelect() {
  const { t } = useTranslation()

  const accounts = useAccounts(state => state.accounts)
  const activate = useAccounts(state => state.activate)
  const authenticated = useSettings(state => state.auth.authenticated)
  const openSection = useSettings(state => state.openSection)

  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  // One row per account, plus the way out to the settings. With no account that leaves a single
  // row, and `useHoverFlyout` rightly refuses to call one row a menu: the button acts directly
  // instead, which is the one thing left to do anyway.
  const flyout = useHoverFlyout(accounts.length + 1)

  const active = activeAccount(accounts)
  const manage = (): void => openSection('account')

  // Authenticated with nothing stored means `secrets/.env` answered — the development fallback
  // in `resolveCredentials`. Calling that "not connected" while every call succeeds would send
  // the reader hunting for a key that is not the problem.
  const label = active?.name ?? t(authenticated ? 'accounts.development' : 'accounts.notConnected')

  return (
    <div {...flyout.wrapProps} className="contents">
      <button
        ref={setAnchor}
        type="button"
        aria-label={t('accounts.switch')}
        // Only when there is one: with nothing stored the button opens the settings outright,
        // and announcing a menu it will never show sends a screen reader looking for it.
        aria-haspopup={flyout.hasFlyout ? 'menu' : undefined}
        aria-expanded={flyout.hasFlyout ? flyout.showing : undefined}
        onClick={flyout.hasFlyout ? flyout.open : manage}
        className={cn(
          'flex h-(--sc-control) cursor-pointer items-center gap-1.5 rounded-(--radius-sc-md)',
          'text-muted hover:bg-elevated/60 hover:text-text border-none bg-transparent px-2',
          'max-w-44 text-[11px] transition-colors',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            // Follows the probe alone: it answers for whatever credentials the main process
            // resolved, which is the active account or the development fallback behind it.
            authenticated ? 'bg-success' : 'bg-muted',
          )}
        />
        <span className="truncate">{label}</span>
        <UiIcon path={mdiChevronDown} size={12} />
      </button>

      {flyout.showing && (
        <Flyout anchor={anchor} placement="below" {...flyout.flyoutProps}>
          {accounts.map(account => (
            <MenuRow
              key={account.id}
              label={account.name}
              icon={mdiCloudOutline}
              checked={account.active}
              onSelect={() => {
                flyout.close()
                void activate(account.id)
              }}
            />
          ))}

          {accounts.length > 0 && <Separator orientation="horizontal" className="self-center" />}

          <MenuRow
            label={t('accounts.manage')}
            icon={mdiCogOutline}
            onSelect={() => {
              flyout.close()
              manage()
            }}
          />
        </Flyout>
      )}
    </div>
  )
}
