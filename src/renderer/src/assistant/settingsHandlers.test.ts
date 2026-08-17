import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountSummary } from '@shared/domain/account'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { runAction } from './executor'

const ACCOUNTS: AccountSummary[] = [
  { id: 'acc-1', name: 'Studio', active: true },
  { id: 'acc-2', name: 'Perso', active: false },
]

beforeEach(() => {
  installFakeBridge()
})

describe('the settings', () => {
  it('answers them whole', async () => {
    expect(await runAction('settings.read', {})).toEqual({ ok: true, data: DEFAULT_SETTINGS })
  })

  it('writes one section without restating the others', async () => {
    const write = vi.fn(async () => DEFAULT_SETTINGS)
    installFakeBridge({ settings: { write } })

    await runAction('settings.write', { settings: { mcp: { enabled: true } } })
    expect(write).toHaveBeenCalledWith({ mcp: { enabled: true } })
  })

  /**
   * `write` merges branch by branch, so a branch the studio does not know is carried through
   * unread. Refusing a change that moves nothing is what keeps a misspelt section from being
   * reported as done.
   */
  it('refuses a change that names nothing the studio knows', async () => {
    const write = vi.fn(async () => DEFAULT_SETTINGS)
    installFakeBridge({ settings: { write } })

    expect(await runAction('settings.write', { settings: { colours: { accent: 'red' } } })).toEqual(
      { ok: false, refusal: 'badInput' },
    )
    expect(write).not.toHaveBeenCalled()
  })

  /**
   * `in` answers true for what `Object.prototype` carries, and `JSON.parse` hands `__proto__`
   * over as an OWN key — so these reached the merge, vanished in it, and were answered `ok`.
   */
  it('refuses a section that only the prototype answers to', async () => {
    const write = vi.fn(async () => DEFAULT_SETTINGS)
    installFakeBridge({ settings: { write } })

    for (const section of ['__proto__', 'toString', 'constructor', 'valueOf']) {
      expect(await runAction('settings.write', { settings: { [section]: { a: 1 } } })).toEqual({
        ok: false,
        refusal: 'badInput',
      })
    }
    expect(write).not.toHaveBeenCalled()
  })

  // Writing a value that is already set is a legitimate call — a client settling a state it did
  // not read first — and refusing it would make idempotence a failure.
  it('lets a value be written to what it already is', async () => {
    const write = vi.fn(async () => DEFAULT_SETTINGS)
    installFakeBridge({ settings: { write } })

    expect(
      await runAction('settings.write', { settings: { mcp: { enabled: false } } }),
    ).toMatchObject({ ok: true })
    expect(write).toHaveBeenCalledWith({ mcp: { enabled: false } })
  })
})

describe('the accounts', () => {
  it('lists them, and never a key', async () => {
    installFakeBridge({ accounts: { list: vi.fn(async () => ACCOUNTS) } })

    expect(await runAction('accounts.list', {})).toEqual({ ok: true, data: ACCOUNTS })
  })

  it('switches to one it holds, and refuses an id it does not', async () => {
    const activate = vi.fn(async () => ({ accounts: ACCOUNTS }))
    installFakeBridge({ accounts: { list: vi.fn(async () => ACCOUNTS), activate } })

    expect(await runAction('accounts.activate', { accountId: 'acc-2' })).toMatchObject({ ok: true })
    expect(activate).toHaveBeenCalledWith('acc-2')

    expect(await runAction('accounts.activate', { accountId: 'acc-9' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })
})
