import { useId, useState, type SubmitEvent } from 'react'
import { cn } from '@/helpers/cn'
import { WINDOW_ACTION } from '@/design/windowStyles'
import { useTranslation } from 'react-i18next'
import { WindowFailure } from '@/design/WindowFailure'
import { FormField } from '@/design/FormField'
import { checkAccountName } from '@shared/domain/account'
import { CLOUD_IDS, cloudAuth, isCloudProviderId, SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { HINT_TOP } from '@/helpers/tooltip'
import { useAccounts, type AccountSaveFailure } from '@/stores/accounts'
import { FAILURE_KEYS } from './failureKeys'

export function AccountSettingsAddForm() {
  const form = useId()
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
      <FormField label={t('accounts.provider')} htmlFor={`${form}provider`}>
        <select
          id={`${form}provider`}
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
      </FormField>

      <FormField label={t('accounts.name')} htmlFor={`${form}name`}>
        <input
          id={`${form}name`}
          data-sc="field:newAccount.name"
          className="input input-sm w-full"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('accounts.namePlaceholder')}
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </FormField>

      <FormField label={t('auth.key')} htmlFor={`${form}key`}>
        <input
          id={`${form}key`}
          data-sc="field:newAccount.key"
          className="input input-sm w-full"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={event => setKey(event.target.value)}
        />
      </FormField>

      {wantsSecret && (
        <FormField label={t('auth.secret')} htmlFor={`${form}secret`}>
          <input
            id={`${form}secret`}
            data-sc="field:newAccount.secret"
            className="input input-sm w-full"
            type="password"
            autoComplete="off"
            value={secret}
            onChange={event => setSecret(event.target.value)}
          />
        </FormField>
      )}

      {failure && <WindowFailure>{t(FAILURE_KEYS[failure])}</WindowFailure>}

      <button
        type="submit"
        className={cn(WINDOW_ACTION, 'mt-1')}
        {...HINT_TOP(t('accounts.addHint'))}
        disabled={busy || !complete}
      >
        {busy ? t('accounts.adding') : t('accounts.add')}
      </button>
    </form>
  )
}
