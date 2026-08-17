import { describe, expect, it } from 'vitest'
import { createCredentialVault, type SecretStore } from './credentials'

/**
 * The keychain, stood in for. `safeStorage` does not exist outside a packaged application, and
 * what is checked here is the bookkeeping around it — which host holds what, and what happens
 * when the machine can no longer read what it wrote.
 *
 * NOT `memoryAdapter`, which the settings store is checked through, and the difference is the
 * whole of one case below: its `encrypt` writes `enc:<plain>`, so "what lands on disk is not the
 * token" would read the token straight out of the sealed value. A stand-in has to be opaque for
 * that case to be about the code at all.
 */
function store(broken = false): SecretStore & { values: Record<string, unknown> } {
  const values: Record<string, unknown> = {}

  return {
    values,
    read: <T>(key: string) => values[key] as T | undefined,
    write: (key, value) => {
      values[key] = value
    },
    encrypt: plain => Buffer.from(plain, 'utf8').toString('base64'),
    decrypt: sealed => {
      if (broken) throw new Error('this keychain has moved on')
      return Buffer.from(sealed, 'base64').toString('utf8')
    },
  }
}

describe('the tokens a studio keeps', () => {
  it('holds one per host, and answers each with its own', () => {
    const vault = createCredentialVault(store())

    vault.set('github.com', { user: 'alban', token: 'ghp_a' })
    vault.set('git.company.fr', { user: 'ap', token: 'glpat_b' })

    expect(vault.read('github.com')).toEqual({ user: 'alban', token: 'ghp_a' })
    expect(vault.read('git.company.fr')).toEqual({ user: 'ap', token: 'glpat_b' })
  })

  it('knows whether a host has one without being asked for it', () => {
    const vault = createCredentialVault(store())
    vault.set('github.com', { user: 'alban', token: 'ghp_a' })

    expect(vault.has('github.com')).toBe(true)
    expect(vault.has('gitlab.com')).toBe(false)
  })

  /** The whole point of the keychain: what lands on disk must not be the token. */
  it('never writes the token down as it was given', () => {
    const backing = store()
    createCredentialVault(backing).set('github.com', { user: 'alban', token: 'ghp_secret' })

    expect(JSON.stringify(backing.values)).not.toContain('ghp_secret')
  })

  it('forgets one host without touching the others', () => {
    const vault = createCredentialVault(store())
    vault.set('github.com', { user: 'alban', token: 'ghp_a' })
    vault.set('gitlab.com', { user: 'alban', token: 'glpat_b' })

    vault.clear('github.com')

    expect(vault.has('github.com')).toBe(false)
    expect(vault.has('gitlab.com')).toBe(true)
  })

  /**
   * A restored machine, a changed login: the value is there and will not open. Answering nothing
   * sends the panel back to asking for the token, which is the only thing anybody can do about it.
   */
  it('answers nothing rather than throwing when the keychain has moved on', () => {
    const backing = store()
    createCredentialVault(backing).set('github.com', { user: 'alban', token: 'ghp_a' })

    const afterwards = createCredentialVault({ ...backing, decrypt: store(true).decrypt })

    expect(afterwards.read('github.com')).toBeNull()
  })

  it('answers nothing for a host it has never held', () => {
    expect(createCredentialVault(store()).read('github.com')).toBeNull()
  })
})
