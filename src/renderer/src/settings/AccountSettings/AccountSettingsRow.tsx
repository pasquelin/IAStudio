import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { WindowFailure } from '@/components/WindowFailure'
import { checkAccountName, type AccountSummary } from '@shared/domain/account'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { cn } from '@/helpers/cn'
import { HINT_LEFT, HINT_TOP } from '@/helpers/tooltip'
import { useAccounts, type AccountSaveFailure } from '@/stores/accounts'
import { useCredits } from '@/stores/credits'
import { WINDOW_ACTION, WINDOW_ACTION_SECONDARY, WINDOW_CAPTION } from '@/components/windowStyles'
import { describeCredit } from '@/helpers/describeCredit'
import { FAILURE_KEYS } from './failureKeys'

type AccountSettingsRowProps = {
  account: AccountSummary
  /** Only the account in use can report whether its key works. */
  authenticated: boolean
}

export function AccountSettingsRow({ account, authenticated }: AccountSettingsRowProps) {
  const { t, i18n } = useTranslation()
  const accounts = useAccounts(state => state.accounts)
  const rename = useAccounts(state => state.rename)
  const remove = useAccounts(state => state.remove)
  const activate = useAccounts(state => state.activate)
  const balances = useCredits(state => state.balances)

  // One state, not two: a draft that exists IS the editing mode, so the two cannot disagree.
  const [draft, setDraft] = useState<string | null>(null)
  const [failure, setFailure] = useState<AccountSaveFailure | null>(null)

  const keyWorks = (account.providerId ?? SCENARIO_CLOUD) !== SCENARIO_CLOUD || authenticated
  const credit = describeCredit(balances?.[account.id], i18n.language)

  const stopEditing = (): void => {
    setDraft(null)
    setFailure(null)
  }

  const submit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (draft === null) return

    const refused = await rename(account.id, draft.trim())
    if (refused) setFailure(refused)
    else stopEditing()
  }

  if (draft !== null) {
    return (
      <li>
        <form className="flex items-center gap-2" onSubmit={submit}>
          <input
            data-sc="field:account.name"
            className="input input-sm flex-1"
            aria-label={t('accounts.name')}
            autoFocus
            value={draft}
            onChange={event => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className={WINDOW_ACTION}
            {...HINT_TOP(t('accounts.saveHint'))}
            disabled={checkAccountName(draft, accounts, account.id) !== null}
          >
            {t('accounts.save')}
          </button>
          <button
            type="button"
            className={WINDOW_ACTION_SECONDARY}
            {...HINT_TOP(t('accounts.cancelHint'))}
            onClick={stopEditing}
          >
            {t('accounts.cancel')}
          </button>
        </form>
        {failure && <WindowFailure className="mt-1">{t(FAILURE_KEYS[failure])}</WindowFailure>}
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="flex flex-1 items-center gap-2 truncate text-sm">
          {account.name}
          {account.active && (
            <span className={cn('badge badge-sm', keyWorks ? 'badge-success' : 'badge-error')}>
              {keyWorks ? t('accounts.active') : t('accounts.notConnected')}
            </span>
          )}
        </span>

        {!account.active && (
          <button
            type="button"
            className={WINDOW_ACTION}
            {...HINT_LEFT(t('accounts.useHint'))}
            onClick={() => void activate(account.id)}
          >
            {t('accounts.use')}
          </button>
        )}

        <button
          type="button"
          className={WINDOW_ACTION_SECONDARY}
          {...HINT_LEFT(t('accounts.renameHint'))}
          onClick={() => setDraft(account.name)}
        >
          {t('accounts.rename')}
        </button>
        <button
          type="button"
          className={cn(WINDOW_ACTION_SECONDARY, 'text-error')}
          {...HINT_LEFT(t('accounts.removeHint'))}
          onClick={() => void remove(account.id)}
        >
          {t('accounts.remove')}
        </button>
      </div>

      {/* Said in full here: the menu has a column for a figure, not for why there is none. */}
      {balances && (
        <p className={WINDOW_CAPTION}>{t(credit.sentenceKey, { amount: credit.figure })}</p>
      )}
    </li>
  )
}
