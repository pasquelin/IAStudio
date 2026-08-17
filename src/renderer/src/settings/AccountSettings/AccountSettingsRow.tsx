import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { checkAccountName, type AccountSummary } from '@shared/domain/account'
import { cn } from '@/helpers/cn'
import { HINT_LEFT, HINT_TOP } from '@/helpers/tooltip'
import { useAccounts, type AccountSaveFailure } from '@/stores/accounts'
import { FAILURE_KEYS } from './failureKeys'

type AccountSettingsRowProps = {
  account: AccountSummary
  /** Only the account in use can report whether its key works. */
  authenticated: boolean
}

export function AccountSettingsRow({ account, authenticated }: AccountSettingsRowProps) {
  const { t } = useTranslation()
  const accounts = useAccounts(state => state.accounts)
  const rename = useAccounts(state => state.rename)
  const remove = useAccounts(state => state.remove)
  const activate = useAccounts(state => state.activate)

  // One state, not two: a draft that exists IS the editing mode, so the two cannot disagree.
  const [draft, setDraft] = useState<string | null>(null)
  const [failure, setFailure] = useState<AccountSaveFailure | null>(null)

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
            className="input input-sm flex-1"
            aria-label={t('accounts.name')}
            autoFocus
            value={draft}
            onChange={event => setDraft(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn-sm btn-primary"
            {...HINT_TOP(t('accounts.saveHint'))}
            disabled={checkAccountName(draft, accounts, account.id) !== null}
          >
            {t('accounts.save')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            {...HINT_TOP(t('accounts.cancelHint'))}
            onClick={stopEditing}
          >
            {t('accounts.cancel')}
          </button>
        </form>
        {failure && (
          <p role="alert" className="text-error mt-1 text-xs">
            {t(FAILURE_KEYS[failure])}
          </p>
        )}
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2">
      <span className="flex flex-1 items-center gap-2 truncate text-sm">
        {account.name}
        {account.active && (
          <span className={cn('badge badge-sm', authenticated ? 'badge-success' : 'badge-error')}>
            {authenticated ? t('accounts.active') : t('accounts.notConnected')}
          </span>
        )}
        {account.readOnly && <span className="badge badge-sm">{t('accounts.fromEnvFile')}</span>}
      </span>

      {!account.active && (
        <button
          type="button"
          className="btn btn-sm"
          {...HINT_LEFT(t('accounts.useHint'))}
          onClick={() => void activate(account.id)}
        >
          {t('accounts.use')}
        </button>
      )}

      {/* Edited in `secrets/.env`: buttons that could only be refused are worse than no buttons. */}
      {!account.readOnly && (
        <>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            {...HINT_LEFT(t('accounts.renameHint'))}
            onClick={() => setDraft(account.name)}
          >
            {t('accounts.rename')}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost text-error"
            {...HINT_LEFT(t('accounts.removeHint'))}
            onClick={() => void remove(account.id)}
          >
            {t('accounts.remove')}
          </button>
        </>
      )}
    </li>
  )
}
