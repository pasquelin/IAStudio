import { useEffect, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { checkAccountName, type AccountSummary } from '@shared/domain/account'
import { cn } from '@/helpers/cn'
import { HINT_LEFT, HINT_TOP } from '@/helpers/tooltip'
import { failureMessageKey } from '@/services/failure-message'
import { useAccounts, type AccountSaveFailure } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'

// A table rather than a template: a member added to the union stops the build here instead of
// rendering a missing key on screen. Same reason `failureMessageKey` gives.
const FAILURE_KEYS: Record<AccountSaveFailure, string> = {
  empty: 'accounts.errors.empty',
  'too-long': 'accounts.errors.too-long',
  duplicate: 'accounts.errors.duplicate',
  'unknown-account': 'accounts.errors.unknown-account',
  'store-unreadable': 'accounts.errors.store-unreadable',
  'read-only-account': 'accounts.errors.read-only-account',
  unexpected: 'accounts.errors.unexpected',
}

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
        <p className="text-base-content/60 text-xs">{t('accounts.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map(account => (
            <AccountRow key={account.id} account={account} authenticated={auth.authenticated} />
          ))}
        </ul>
      )}

      {!auth.authenticated && accounts.length > 0 && (
        <p role="alert" className="text-error text-xs">
          {t(failureMessageKey(auth.reason))}
        </p>
      )}

      <AddAccountForm />

      <p className="text-base-content/60 text-xs">{t('accounts.explanation')}</p>
      <p className="text-base-content/60 text-xs">{t('auth.explanation')}</p>
    </div>
  )
}

type AccountRowProps = {
  account: AccountSummary
  /** Only the account in use can report whether its key works. */
  authenticated: boolean
}

function AccountRow({ account, authenticated }: AccountRowProps) {
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

function AddAccountForm() {
  const { t } = useTranslation()
  const accounts = useAccounts(state => state.accounts)
  const add = useAccounts(state => state.add)

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AccountSaveFailure | null>(null)

  const complete =
    checkAccountName(name, accounts) === null && key.trim().length > 0 && secret.trim().length > 0

  const submit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      const refused = await add(name.trim(), key, secret)
      setFailure(refused)
      if (refused) return

      setName('')
      setKey('')
      setSecret('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="flex flex-col gap-3 border-t border-current/10 pt-4" onSubmit={submit}>
      <label className="flex flex-col gap-2 text-xs">
        {t('accounts.name')}
        <input
          className="input input-sm w-full"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('accounts.namePlaceholder')}
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2 text-xs">
        {t('auth.key')}
        <input
          className="input input-sm w-full"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={event => setKey(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-2 text-xs">
        {t('auth.secret')}
        <input
          className="input input-sm w-full"
          type="password"
          autoComplete="off"
          value={secret}
          onChange={event => setSecret(event.target.value)}
        />
      </label>

      {failure && (
        <p role="alert" className="text-error text-xs">
          {t(FAILURE_KEYS[failure])}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-sm mt-1"
        {...HINT_TOP(t('accounts.addHint'))}
        disabled={busy || !complete}
      >
        {busy ? t('accounts.adding') : t('accounts.add')}
      </button>
    </form>
  )
}
