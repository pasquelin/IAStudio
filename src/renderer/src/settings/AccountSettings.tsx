import { useEffect, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { failureMessageKey } from '@/services/failure-message'
import { useSettings } from '@/stores/settings'

/**
 * API credentials. DaisyUI rather than the in-house design system: this is a surface where
 * the studio becomes an application again — see CLAUDE.md.
 *
 * What is typed is never read back. The renderer learns whether the credentials work, never
 * what they are, so the fields are cleared even on success.
 */
export function AccountSettings() {
  const { t } = useTranslation()

  const auth = useSettings(state => state.auth)
  const signIn = useSettings(state => state.signIn)
  const signOut = useSettings(state => state.signOut)
  const refreshAuth = useSettings(state => state.refreshAuth)

  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    void refreshAuth()
  }, [refreshAuth])

  const submit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      await signIn(key, secret)
      setAttempted(true)
      setKey('')
      setSecret('')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async (): Promise<void> => {
    setBusy(true)
    try {
      await signOut()
      setAttempted(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex max-w-md flex-col gap-3">
      <h2 className="text-base font-semibold">{t('auth.title')}</h2>
      <p className="text-base-content/60 text-xs">{t('auth.explanation')}</p>

      {auth.authenticated ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-success text-sm">{t('auth.connected')}</span>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={disconnect}>
            {t('auth.signOut')}
          </button>
        </div>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <label className="flex flex-col gap-1 text-xs">
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

          <label className="flex flex-col gap-1 text-xs">
            {t('auth.secret')}
            <input
              className="input input-sm w-full"
              type="password"
              autoComplete="off"
              value={secret}
              onChange={event => setSecret(event.target.value)}
            />
          </label>

          {attempted && (
            <p role="alert" className="text-error text-xs">
              {t(failureMessageKey(auth.reason))}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-sm mt-1" disabled={busy}>
            {busy ? t('auth.checking') : t('auth.signIn')}
          </button>
        </form>
      )}
    </section>
  )
}
