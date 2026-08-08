import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ACCOUNT_NAME, ENVIRONMENT_ACCOUNT_ID } from '@shared/domain/account'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import type { StoredAccount } from './accounts'
import { memoryAdapter, type MemoryAdapter } from './memory-adapter'
import { createSettingsStore, type SettingsStore } from './store'

/** Ids are generated; naming them is what lets a test assert on the stored blob. */
function countingIds(): () => string {
  let next = 0
  return () => `id-${++next}`
}

describe('settings store', () => {
  let adapter: MemoryAdapter

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  const storeWithAccount = (): SettingsStore => {
    const store = createSettingsStore(adapter, { newAccountId: countingIds() })
    store.addAccount('Studio', { key: 'api_k', secret: 's3cr3t' })
    return store
  }

  it('returns the defaults when nothing is stored', () => {
    expect(createSettingsStore(adapter).read()).toEqual(DEFAULT_SETTINGS)
  })

  it('falls back to the defaults when the stored settings are unusable', () => {
    adapter.raw.set('settings', { appearance: { theme: 'purple' } })
    expect(createSettingsStore(adapter).read()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges a partial write section by section', () => {
    const store = createSettingsStore(adapter)
    store.write({ appearance: { density: 'compact' } })

    const settings = store.read()
    expect(settings.appearance.density).toBe('compact')
    expect(settings.appearance.theme).toBe(DEFAULT_SETTINGS.appearance.theme)
    expect(settings.generation).toEqual(DEFAULT_SETTINGS.generation)
  })

  it('reads a config file written before the media section existed', () => {
    // Every release adds settings; a file from the previous one must not lose the rest.
    adapter.write('settings', { appearance: { density: 'compact' } })

    const settings = createSettingsStore(adapter).read()
    expect(settings.media).toEqual({})
    expect(settings.appearance.density).toBe('compact')
  })

  it('keeps the ffmpeg path across another section being written', () => {
    const store = createSettingsStore(adapter)
    store.write({ media: { ffmpegPath: '/opt/homebrew/bin/ffmpeg' } })
    store.write({ appearance: { theme: 'light' } })

    expect(store.read().media.ffmpegPath).toBe('/opt/homebrew/bin/ffmpeg')
  })

  // Without this, a theme changed in the settings window reaches the studio on next launch.
  it('reports every write, so the other windows can follow', () => {
    const changes: Settings[] = []
    const store = createSettingsStore(adapter, { onChange: current => changes.push(current) })

    store.write({ appearance: { density: 'compact' } })

    expect(changes).toHaveLength(1)
    expect(changes[0]?.appearance.density).toBe('compact')
    // The whole state, not the partial: a window replicates settings, it does not patch them.
    expect(changes[0]?.generation).toEqual(DEFAULT_SETTINGS.generation)
  })

  it('reports a write nobody asked for through the IPC, like the project it just opened', () => {
    const changes: Settings[] = []
    const store = createSettingsStore(adapter, { onChange: current => changes.push(current) })

    store.write({ storage: { lastProject: '/tmp/demo' } })

    expect(changes.at(-1)?.storage.lastProject).toBe('/tmp/demo')
  })

  it('says nothing on a read', () => {
    const changes: Settings[] = []
    createSettingsStore(adapter, { onChange: current => changes.push(current) }).read()

    expect(changes).toEqual([])
  })

  it('never exposes credentials through the settings it returns', () => {
    const store = storeWithAccount()
    expect(JSON.stringify(store.read())).not.toContain('s3cr3t')
  })

  it('stores the whole book encrypted, never in clear', () => {
    storeWithAccount()
    expect(String(adapter.raw.get('accounts'))).toBe(
      'enc:{"accounts":[{"id":"id-1","name":"Studio","credentials":{"key":"api_k","secret":"s3cr3t"}}],"activeId":"id-1"}',
    )
  })

  it('reads back the credentials of the active account', () => {
    const store = storeWithAccount()
    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
    expect(store.hasCredentials()).toBe(true)
  })

  it('follows a switch to another account', () => {
    const store = storeWithAccount()
    store.addAccount('Client X', { key: 'other_k', secret: 'other_s' })

    // Adding does not switch: the user was configuring, not moving.
    expect(store.readCredentials()?.key).toBe('api_k')

    store.activateAccount('id-2')
    expect(store.readCredentials()?.key).toBe('other_k')
  })

  it('reports an unreadable book without deleting it', () => {
    adapter.raw.set('accounts', 'garbage')
    const store = createSettingsStore(adapter)

    expect(store.hasCredentials()).toBe(false)
    expect(store.accounts()).toEqual([])
    // A transient keychain failure must not cost the user every key they hold.
    expect(adapter.raw.has('accounts')).toBe(true)
  })

  /*
   * A keychain can be locked, or resolve to another backend for one launch. `settleAccounts`
   * runs before the first window, so erasing there is permanent and silent: the user comes
   * back with every key gone. Reading empty is enough to make the screens ask for one.
   */
  it('never erases an unreadable book, however it is read', () => {
    adapter.raw.set('accounts', 'garbage')
    const store = createSettingsStore(adapter)

    store.settleAccounts()
    void store.accounts()
    void store.hasCredentials()

    expect(adapter.raw.get('accounts')).toBe('garbage')
  })

  it('refuses to write over a book the keychain would not hand back', () => {
    adapter.raw.set('accounts', 'garbage')
    const store = createSettingsStore(adapter)

    // The screen says "no account yet", so adding one is exactly what the user does next.
    expect(() => store.addAccount('Studio', { key: 'k', secret: 's' })).toThrow('store-unreadable')
    expect(adapter.raw.get('accounts')).toBe('garbage')
  })

  /*
   * Decrypted fine, holds no book — a truncated write, a hand edit, a shape from another
   * version. The keychain is healthy and the content is unrecoverable whatever we do, so
   * refusing here would lock the user out of their own accounts for good, on every launch,
   * while blaming a keychain that is working.
   */
  it('lets the user write over content that decrypted but holds no book', () => {
    adapter.raw.set('accounts', 'enc:{"accounts":"nope"}')
    const store = createSettingsStore(adapter, { newAccountId: countingIds() })

    expect(() => store.addAccount('Studio', { key: 'k', secret: 's' })).not.toThrow()
    expect(store.accounts()).toEqual([{ id: 'id-1', name: 'Studio', active: true }])
  })

  it('lets the user write over a blob whose JSON never parsed', () => {
    adapter.raw.set('accounts', 'enc:{"accounts":[')
    const store = createSettingsStore(adapter, { newAccountId: countingIds() })

    expect(() => store.addAccount('Studio', { key: 'k', secret: 's' })).not.toThrow()
    expect(store.hasCredentials()).toBe(true)
  })

  it('survives an activeId that names nothing, keeping the accounts', () => {
    adapter.raw.set(
      'accounts',
      'enc:{"accounts":[{"id":"a","name":"Studio","credentials":{"key":"k","secret":"s"}}],"activeId":42}',
    )

    expect(createSettingsStore(adapter).accounts()).toEqual([
      { id: 'a', name: 'Studio', active: true },
    ])
  })

  it('keeps the accounts that still parse when one entry is broken', () => {
    adapter.raw.set(
      'accounts',
      'enc:{"accounts":[{"id":"a","name":"Studio","credentials":{"key":"k","secret":"s"}},{"id":"b"}],"activeId":"a"}',
    )

    expect(createSettingsStore(adapter).accounts()).toEqual([
      { id: 'a', name: 'Studio', active: true },
    ])
  })

  it('reads a blank pair as unconfigured', () => {
    adapter.raw.set(
      'accounts',
      'enc:{"accounts":[{"id":"a","name":"Studio","credentials":{"key":"","secret":""}}],"activeId":"a"}',
    )
    const store = createSettingsStore(adapter)

    expect(store.readCredentials()).toBeNull()
    expect(store.hasCredentials()).toBe(false)
  })

  it('trims a stored pair, as the input path does', () => {
    adapter.raw.set(
      'accounts',
      'enc:{"accounts":[{"id":"a","name":"Studio","credentials":{"key":"api_k\\n","secret":" s3cr3t "}}],"activeId":"a"}',
    )

    expect(createSettingsStore(adapter).readCredentials()).toEqual({
      key: 'api_k',
      secret: 's3cr3t',
    })
  })

  it('forgets an account on demand', () => {
    const store = storeWithAccount()
    store.removeAccount('id-1')

    expect(store.hasCredentials()).toBe(false)
    expect(store.accounts()).toEqual([])
  })
})

describe('the development account in the store', () => {
  const ENVIRONMENT: StoredAccount = {
    id: ENVIRONMENT_ACCOUNT_ID,
    name: 'Development',
    credentials: { key: 'env_key', secret: 'env_secret' },
    origin: 'environment',
  }

  let adapter: MemoryAdapter

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  const storeWithEnvironment = (): SettingsStore =>
    createSettingsStore(adapter, {
      newAccountId: countingIds(),
      environmentAccount: () => ENVIRONMENT,
    })

  it('answers with it on a machine that has stored nothing', () => {
    const store = storeWithEnvironment()

    expect(store.accounts()).toEqual([
      { id: ENVIRONMENT_ACCOUNT_ID, name: 'Development', active: true, readOnly: true },
    ])
    expect(store.readCredentials()).toEqual({ key: 'env_key', secret: 'env_secret' })
    expect(store.hasCredentials()).toBe(true)
  })

  /**
   * The keychain holds what the user typed and nothing else. Persisting a copy of the file
   * would outlive the file: delete `secrets/.env` and the studio would go on spending the key
   * it had squirrelled away, with a row nothing on screen could explain.
   */
  it('never writes it to the keychain', () => {
    const store = storeWithEnvironment()
    store.addAccount('Studio', { key: 'api_k', secret: 's3cr3t' })

    const written: unknown = JSON.parse(adapter.decrypt(adapter.read<string>('accounts') ?? ''))

    expect(written).toEqual({
      accounts: [{ id: 'id-1', name: 'Studio', credentials: { key: 'api_k', secret: 's3cr3t' } }],
      activeId: ENVIRONMENT_ACCOUNT_ID,
    })
  })

  // The file is gone, and the choice it left behind cannot be honoured: the studio falls
  // through to the key the user typed rather than to nothing at all.
  it('hands over to a stored account once the file is gone', () => {
    storeWithEnvironment().addAccount('Studio', { key: 'api_k', secret: 's3cr3t' })
    const store = createSettingsStore(adapter, { environmentAccount: () => null })

    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
  })

  // The rule every account follows: adding a key is configuring, not switching.
  it('stays in use when a first key is stored beside it', () => {
    const store = storeWithEnvironment()
    const change = store.addAccount('Studio', { key: 'api_k', secret: 's3cr3t' })

    expect(change.credentialsChanged).toBe(false)
    expect(store.readCredentials()).toEqual({ key: 'env_key', secret: 'env_secret' })
  })

  it('hands over once the stored account is switched to', () => {
    const store = storeWithEnvironment()
    store.addAccount('Studio', { key: 'api_k', secret: 's3cr3t' })

    expect(store.activateAccount('id-1').credentialsChanged).toBe(true)
    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
  })

  it('refuses to rename or remove it', () => {
    const store = storeWithEnvironment()

    expect(() => store.renameAccount(ENVIRONMENT_ACCOUNT_ID, 'Mine')).toThrow('read-only-account')
    expect(() => store.removeAccount(ENVIRONMENT_ACCOUNT_ID)).toThrow('read-only-account')
  })

  // Locked keychain in development: the file is still readable, and the studio still runs.
  it('still answers when the stored book cannot be read', () => {
    adapter.raw.set('accounts', 'not encrypted by us')
    const store = storeWithEnvironment()

    expect(store.readCredentials()).toEqual({ key: 'env_key', secret: 'env_secret' })
  })

  it('leaves the account list empty once the file is gone', () => {
    const store = createSettingsStore(adapter, { environmentAccount: () => null })

    expect(store.accounts()).toEqual([])
    expect(store.readCredentials()).toBeNull()
  })
})

describe('carrying a single-credential install over', () => {
  let adapter: MemoryAdapter

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  // The pair stored by every release before accounts existed. Losing it would sign the user
  // out on upgrade, with no way to get the key back.
  it('reads a lone stored pair as one active account, before any write', () => {
    adapter.raw.set('credentials', 'enc:{"key":"api_k","secret":"s3cr3t"}')
    const store = createSettingsStore(adapter)

    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
    expect(store.accounts()).toEqual([
      { id: 'account_migrated', name: DEFAULT_ACCOUNT_NAME, active: true },
    ])
  })

  it('names the same account on every read, so callers agree on its id', () => {
    adapter.raw.set('credentials', 'enc:{"key":"api_k","secret":"s3cr3t"}')
    const store = createSettingsStore(adapter)

    expect(store.accounts()[0]?.id).toBe(store.accounts()[0]?.id)
  })

  it('writes the book and drops the old pair when settled', () => {
    adapter.raw.set('credentials', 'enc:{"key":"api_k","secret":"s3cr3t"}')
    const store = createSettingsStore(adapter)
    store.settleAccounts()

    expect(adapter.raw.has('credentials')).toBe(false)
    expect(String(adapter.raw.get('accounts'))).toContain('"name":"Scenario"')
    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
  })

  // The pair is the only copy of the key. Dropping it before it is safely inside a book means
  // the upgrade this whole migration exists for is what destroys it.
  it('keeps a pair it could not decrypt, rather than dropping it unmigrated', () => {
    adapter.raw.set('credentials', 'garbage')
    const store = createSettingsStore(adapter)

    store.settleAccounts()

    expect(adapter.raw.get('credentials')).toBe('garbage')
    expect(adapter.raw.has('accounts')).toBe(false)
  })

  it('keeps the pair when the keychain cannot encrypt the book it would write', () => {
    adapter.raw.set('credentials', 'enc:{"key":"api_k","secret":"s3cr3t"}')
    const store = createSettingsStore({
      ...adapter,
      encrypt: () => {
        throw new Error('no keychain on this machine')
      },
    })

    // Refusing to launch over a migration that can wait would be worse than postponing it.
    expect(() => store.settleAccounts()).not.toThrow()
    expect(adapter.raw.has('credentials')).toBe(true)
    expect(store.readCredentials()).toEqual({ key: 'api_k', secret: 's3cr3t' })
  })

  /*
   * The pair is the only copy of that key. Erasing it because a book happens to sit beside it
   * destroys a key nothing ever read — the exact loss this migration exists to avoid.
   */
  it('keeps a pair it could not read, even once a book stands beside it', () => {
    adapter.raw.set(
      'accounts',
      'enc:{"accounts":[{"id":"a","name":"Studio","credentials":{"key":"k","secret":"s"}}],"activeId":"a"}',
    )
    adapter.raw.set('credentials', 'garbage')

    createSettingsStore(adapter).settleAccounts()

    expect(adapter.raw.get('credentials')).toBe('garbage')
  })

  it('leaves an existing book alone, and drops the stale pair beside it', () => {
    adapter.raw.set(
      'accounts',
      'enc:{"accounts":[{"id":"a","name":"Studio","credentials":{"key":"k","secret":"s"}}],"activeId":"a"}',
    )
    adapter.raw.set('credentials', 'enc:{"key":"old_k","secret":"old_s"}')

    const store = createSettingsStore(adapter)
    store.settleAccounts()

    expect(store.readCredentials()).toEqual({ key: 'k', secret: 's' })
    expect(store.accounts()).toHaveLength(1)
    // Left behind, it would outlive "remove every account" — a secret nothing erases any more.
    expect(adapter.raw.has('credentials')).toBe(false)
  })

  it('writes nothing when there is nothing at all to carry over', () => {
    const store = createSettingsStore(adapter)
    store.settleAccounts()

    // Runs before the first paint at every launch: it must not touch the disk for nothing.
    expect(adapter.raw.size).toBe(0)
  })
})

describe('resetting', () => {
  /*
   * A write MERGES, and the settings with no default — an accent, an ffmpeg path, a projects
   * folder — have nothing in the defaults to overwrite them. Resetting with a write therefore
   * left exactly the settings it promised to remove.
   */
  it('removes the settings that have no default to fall back on', () => {
    const settings = createSettingsStore(memoryAdapter())
    settings.write({ appearance: { accent: '#ff0000' }, media: { ffmpegPath: '/opt/ffmpeg' } })

    expect(settings.reset()).toEqual(DEFAULT_SETTINGS)
    expect(settings.read().appearance.accent).toBeUndefined()
    expect(settings.read().media.ffmpegPath).toBeUndefined()
  })

  it('tells every window, like any other change', () => {
    const seen: Settings[] = []
    const settings = createSettingsStore(memoryAdapter(), {
      onChange: next => void seen.push(next),
    })

    settings.reset()

    expect(seen).toEqual([DEFAULT_SETTINGS])
  })

  // Accounts live behind their own channels and are not settings; removing one is its own act.
  it('leaves the stored accounts alone', () => {
    const settings = createSettingsStore(memoryAdapter())
    settings.addAccount('Studio', { key: 'k', secret: 's' })

    settings.reset()

    expect(settings.hasCredentials()).toBe(true)
    expect(settings.accounts()).toHaveLength(1)
  })
})
