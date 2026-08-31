import { mdiCloudOutline, mdiCogOutline } from '@mdi/js'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuRow } from '@/design/MenuRow'
import { Separator } from '@/design/Separator'
import { TitleBarSelect } from '@/design/TitleBarSelect'
import { WINDOW_GROUP_LABEL } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { accountsByProvider, activeAccount, useAccounts } from '@/stores/accounts'
import { useCredits } from '@/stores/credits'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { describeCredit } from '@/helpers/describeCredit'
import { projectName } from '@shared/domain/project'

/**
 * Switches which stored API key the studio calls with.
 *
 * A switch, never a form: keys are typed in the settings alone. And a switch of accounts only,
 * not of projects — an API key carries its own Scenario project, which the API exposes no way
 * to list or to choose. What it changes is the remote library; the open local project is the
 * user's disk and stays exactly as it is, and `ProjectSelect` beside it is what moves that.
 *
 * It says WHICH PROJECT it holds for — ADR-21 § D. Switching with a project open records the key
 * against that folder (`storage.projectAccounts`), so reopening it lands on the same library; the
 * button that does that has to state it rather than leave it to be discovered on the next opening.
 */
export function AccountSelect() {
  const { t, i18n } = useTranslation()

  const accounts = useAccounts(state => state.accounts)
  const activate = useAccounts(state => state.activate)
  const authenticated = useSettings(state => state.auth.authenticated)
  const openSection = useSettings(state => state.openSection)
  const project = useProject(state => state.project)
  const balances = useCredits(state => state.balances)
  const refreshCredits = useCredits(state => state.refresh)

  const manage = (): void => openSection('account')

  const groups = accountsByProvider(accounts)
  // One cloud connected: its key, as the button always read. Several: no single key is "the"
  // active one any more — they are one per cloud — so the button counts and the menu details.
  const name =
    groups.length > 1
      ? t('accounts.connectedClouds', { count: groups.length })
      : (activeAccount(accounts)?.name ?? t('accounts.notConnected'))
  const scope = project
    ? t('accounts.scopeProject', { project: projectName(project.path) })
    : t('accounts.scopeApp')

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
      // The scope rides in the hint as well as on the caption below: a menu caption is not a
      // `menuitem`, so a reader walking the menu with the arrow keys never reaches it.
      hint={`${t('accounts.switchHint')} · ${scope}`}
      // One row per account, plus the way out to the settings. With no account that leaves a
      // single row, and `TitleBarSelect` rightly refuses to call one row a menu: the button acts
      // directly instead, which is the one thing left to do anyway.
      rowCount={accounts.length + 1}
      width="max-w-44"
      onAct={manage}
      // Read when the menu appears rather than on mount: a balance nobody is looking at is a
      // round trip per window per launch. The main process caches, so hovering twice costs one.
      onOpen={refreshCredits}
      rows={close => (
        <>
          <p role="presentation" className="text-muted text-mini px-2 py-1">
            {scope}
          </p>

          {groups.map(group => (
            <Fragment key={group.providerId}>
              {/* Named only when there are several: one cloud needs no heading to tell it apart,
                  and a `menuitem` is what the arrow keys walk — a heading is not one. */}
              {groups.length > 1 && (
                <p role="presentation" className={cn(WINDOW_GROUP_LABEL, 'px-2 pt-1')}>
                  {t(`aiClouds.${group.providerId}`)}
                </p>
              )}

              {group.accounts.map(account => {
                // `null` is "never read", which is not "this cloud publishes none" — asserting
                // the second before the first answer lands is a lie on every row.
                const credit = balances && describeCredit(balances[account.id], i18n.language)

                return (
                  <MenuRow
                    key={account.id}
                    label={account.name}
                    icon={mdiCloudOutline}
                    checked={account.active}
                    tick="one-of"
                    // The figure alone: "this cloud publishes none" is a standing property of
                    // the service, said in full on the settings screen and on hover here.
                    note={credit?.figure ?? undefined}
                    tip={HINT_RIGHT(
                      credit
                        ? `${t('accounts.useHint')} · ${t(credit.sentenceKey, { amount: credit.figure })}`
                        : t('accounts.useHint'),
                    )}
                    onSelect={() => {
                      close()
                      void activate(account.id)
                    }}
                  />
                )
              })}
            </Fragment>
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
