import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { checkAccountName } from '@shared/domain/account'
import { CLOUD_IDS, cloudAuth, isCloudProviderId, SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAccounts, type AccountSaveFailure } from '@/stores/accounts'
import { FAILURE_KEYS } from './failureKeys'

export function AccountSettingsAddForm() {
  const { t } = useTranslation()
  const accounts = useAccounts(state => state.accounts)
  const add = useAccounts(state => state.add)

  const [providerId, setProviderId] = useState(SCENARIO_CLOUD)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<AccountSaveFailure | null>(null)

  const wantsSecret = cloudAuth(providerId) === 'key-secret'
  const complete =
    checkAccountName(name, accounts) === null &&
    key.trim().length > 0 &&
    (!wantsSecret || secret.trim().length > 0)

  const submit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      const refused = await add(name.trim(), key, wantsSecret ? secret : '', providerId)
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
        {t('accounts.provider')}
        <select
          data-sc="field:newAccount.provider"
          className="select select-sm w-full"
          value={providerId}
          onChange={event => {
            const id = event.target.value
            if (isCloudProviderId(id)) setProviderId(id)
          }}
        >
          {CLOUD_IDS.map(id => (
            <option key={id} value={id}>
              {t(`aiClouds.${id}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-xs">
        {t('accounts.name')}
        <input
          data-sc="field:newAccount.name"
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
          data-sc="field:newAccount.key"
          className="input input-sm w-full"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={event => setKey(event.target.value)}
        />
      </label>

      {wantsSecret && (
        <label className="flex flex-col gap-2 text-xs">
          {t('auth.secret')}
          <input
            data-sc="field:newAccount.secret"
            className="input input-sm w-full"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={event => setSecret(event.target.value)}
          />
        </label>
      )}

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
