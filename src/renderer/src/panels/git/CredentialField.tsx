import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { QuietNote } from '@/design/QuietNote'
import { FIELD_FILL } from '@/design/styles'
import { isComposing } from '@/helpers/composition'
import { HINT_TOP } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * Where a token is handed over, once — after the server has refused.
 *
 * Asked at the moment of the refusal rather than up front, because up front is asking for a
 * secret before it is needed, from somebody who may never push at all.
 *
 * It goes DOWN and does not come back. The main process encrypts it with the system keychain and
 * hands it to git through the environment of one command; nothing here can read it again, and no
 * channel exists that would. That is invariant 1, and it is the same shape the API key has.
 *
 * The field is a password field, so a screen being recorded — which is what a studio's screen
 * often is — does not put the token in the recording.
 */
export function CredentialField({ host }: { host: string }) {
  const { t } = useTranslation()
  const [user, setUser] = useState('')
  const [token, setToken] = useState('')
  const [held, setHeld] = useState(false)
  const busy = useGit(state => state.busy)
  const setCredentials = useGit(state => state.setCredentials)
  const push = useGit(state => state.push)

  // Whether one is already held changes what this screen MEANS: a refusal with no token is a
  // token that was never given, a refusal with one is a token that is wrong — and the second is
  // the only one where erasing it is the way out.
  useEffect(() => {
    void useGit.getState().hasCredentials(host).then(setHeld)
  }, [host])

  const submit = (): void => {
    if (user.trim() === '' || token === '') return

    void setCredentials(host, user.trim(), token).then(() => {
      setToken('')
      // Straight back to what was refused. The refusal is the only reason this field is on
      // screen, so leaving the user to find the button again would be leaving the job half done.
      return push(false)
    })
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <QuietNote>{held ? t('git.tokenHeld', { host }) : t('git.tokenAsked', { host })}</QuietNote>

      <input
        type="text"
        value={user}
        aria-label={t('git.tokenUser')}
        placeholder={t('git.tokenUserPlaceholder')}
        autoComplete="username"
        disabled={busy}
        className={FIELD_FILL}
        onChange={event => setUser(event.target.value)}
      />
      <input
        type="password"
        value={token}
        aria-label={t('git.token')}
        placeholder={t('git.tokenPlaceholder')}
        autoComplete="current-password"
        disabled={busy}
        className={FIELD_FILL}
        onChange={event => setToken(event.target.value)}
        onKeyDown={event => {
          // Enter belongs to the input method while it composes — see `isComposing`.
          if (event.key === 'Enter' && !isComposing(event)) submit()
        }}
      />

      <Button
        variant="primary"
        {...HINT_TOP(t('git.tokenSaveHint'))}
        disabled={busy || user.trim() === '' || token === ''}
        onClick={submit}
      >
        {t('git.tokenSave')}
      </Button>

      {held && (
        <Button
          {...HINT_TOP(t('git.tokenForgetHint'))}
          disabled={busy}
          onClick={() => {
            void useGit
              .getState()
              .clearCredentials(host)
              .then(() => setHeld(false))
          }}
        >
          {t('git.tokenForget')}
        </Button>
      )}
    </div>
  )
}
