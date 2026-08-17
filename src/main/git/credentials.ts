import { isRecord } from '@shared/guards'
import type { PersistenceAdapter } from '@main/settings/store'

/**
 * What a token is stored through: the four calls of the settings adapter this needs, and no more.
 * Narrowed rather than redeclared — written out again, the two shapes are free to drift, and this
 * is handed the studio's own adapter at every call site but the tests.
 */
export type SecretStore = Pick<PersistenceAdapter, 'read' | 'write' | 'encrypt' | 'decrypt'>

/** The user and the token git will be handed for one host. NEVER leaves the main process. */
export type GitCredential = { user: string; token: string }

const KEY = 'gitCredentials'

/**
 * Tokens for the servers this studio pushes to.
 *
 * Per HOST, not per project or per remote: one personal token opens every repository somebody
 * has on GitHub, and asking for it once per project would be asking for the same string over and
 * over. A company server keeps its own.
 *
 * The renderer can ask WHETHER a host has one and can set one; it can never read one back. That
 * is invariant 1 word for word, and it is the same shape the API key already has.
 */
export type CredentialVault = {
  has: (host: string) => boolean
  set: (host: string, credential: GitCredential) => void
  clear: (host: string) => void
  /** Main-process only. What goes into the environment of one git command, and nowhere else. */
  read: (host: string) => GitCredential | null
}

export function createCredentialVault(store: SecretStore): CredentialVault {
  const held = (): Record<string, unknown> => {
    const value = store.read<unknown>(KEY)
    return isRecord(value) ? value : {}
  }

  return {
    has: host => host in held(),

    set: (host, credential) => {
      // The user is stored in clear and the token is not, which is the whole distinction: a
      // username is on the remote URL already, a token is the password.
      store.write(KEY, {
        ...held(),
        [host]: { user: credential.user, token: store.encrypt(credential.token) },
      })
    },

    clear: host => {
      store.write(KEY, Object.fromEntries(Object.entries(held()).filter(([key]) => key !== host)))
    },

    read: host => {
      const entry = held()[host]
      if (!isRecord(entry)) return null

      const { user, token } = entry
      if (typeof user !== 'string' || typeof token !== 'string') return null

      try {
        return { user, token: store.decrypt(token) }
      } catch {
        // A keychain that has moved on — a restored machine, a changed login — leaves a value
        // that will not decrypt. Answering nothing sends the panel back to asking for the token,
        // which is the only thing anyone can do about it.
        return null
      }
    },
  }
}
