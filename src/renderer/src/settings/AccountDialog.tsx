import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { failureMessageKey } from '@/services/failure-message'
import { useSettings } from '@/stores/settings'

/**
 * Account settings, opened by ⌘,. Built with DaisyUI rather than the in-house design system:
 * this is a surface where the studio becomes an application again — see CLAUDE.md.
 */
export function AccountDialog() {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)

  const open = useSettings(state => state.accountDialogOpen)
  const close = useSettings(state => state.closeAccountDialog)
  const auth = useSettings(state => state.auth)
  const signIn = useSettings(state => state.signIn)
  const signOut = useSettings(state => state.signOut)
  const refreshAuth = useSettings(state => state.refreshAuth)

  const [key, setKey] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    const element = dialog.current
    if (!element) return

    if (open) {
      element.showModal()
      void refreshAuth()
    } else if (element.open) {
      element.close()
    }
  }, [open, refreshAuth])

  const submit = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setBusy(true)
    try {
      await signIn(key, secret)
      setAttempted(true)
      // Nothing typed is kept in component state: the fields are cleared even on success,
      // so a re-open never redisplays what was entered.
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
    <dialog ref={dialog} className="modal" onClose={close} aria-label={t('auth.title')}>
      <div className="modal-box max-w-md">
        <h2 className="text-base font-semibold">{t('auth.title')}</h2>
        <p className="text-base-content/60 mt-1 text-xs">{t('auth.explanation')}</p>

        {auth.authenticated ? (
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-success text-sm">{t('auth.connected')}</span>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={disconnect}>
              {t('auth.signOut')}
            </button>
          </div>
        ) : (
          <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
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

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            {t('actions.close')}
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button type="submit">{t('actions.close')}</button>
      </form>
    </dialog>
  )
}
