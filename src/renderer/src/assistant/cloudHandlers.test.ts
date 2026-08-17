import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { runAction } from './executor'

beforeEach(() => {
  installFakeBridge()
})

describe('the remote library', () => {
  /**
   * Every narrowing is asked affirmatively and omitted when absent, exactly as `assets.search`
   * does: an empty list of kinds is not "everything of no kind", it is a question the API does
   * not answer.
   */
  it('passes only the narrowings it was given', async () => {
    const browse = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    await runAction('cloud.browse', { text: 'stone', types: ['texture'], pageSize: 20 })
    expect(browse).toHaveBeenCalledWith({ text: 'stone', types: ['texture'], pageSize: 20 })

    await runAction('cloud.browse', {})
    expect(browse).toHaveBeenLastCalledWith({})
  })

  /**
   * The whole call, not the one bad item: `types` closes over the six kinds, and the registry
   * refuses a list holding anything else. Dropping it silently would have the client believe it
   * searched for a kind nobody looked up.
   */
  it('refuses a list holding a kind the studio does not have', async () => {
    const browse = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    expect(await runAction('cloud.browse', { types: ['texture', 'hologram'] })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(browse).not.toHaveBeenCalled()
  })

  it('reads the public feed of one kind, and refuses a kind that is not one', async () => {
    const explore = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { explore } })

    await runAction('cloud.explore', { type: 'image', cursor: 'page-2' })
    expect(explore).toHaveBeenCalledWith({ type: 'image', cursor: 'page-2' })

    expect(await runAction('cloud.explore', { type: 'hologram' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('plans a synchronisation before either half costs a request', async () => {
    const plan = vi.fn(async () => ({
      actions: [],
      summary: { push: 0, pull: 0, conflict: 0, skip: 0 },
    }))
    installFakeBridge({ cloud: { plan } })

    await runAction('cloud.plan', { assetIds: ['asset-1'], policy: 'two-way' })
    expect(plan).toHaveBeenCalledWith(['asset-1'], 'two-way')
  })

  it('fetches and sends through their own channels', async () => {
    const pull = vi.fn(async () => [])
    const push = vi.fn(async () => [])
    installFakeBridge({ cloud: { pull, push } })

    await runAction('cloud.pull', { remoteAssetIds: ['remote-1'] })
    await runAction('cloud.push', { assetIds: ['asset-1'] })

    expect(pull).toHaveBeenCalledWith(['remote-1'])
    expect(push).toHaveBeenCalledWith(['asset-1'])
  })
})
