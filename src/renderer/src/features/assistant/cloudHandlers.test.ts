import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { runAction } from './executor'

beforeEach(() => {
  installFakeBridge()
})

describe('the remote library', () => {
  /**
   * Every narrowing is asked affirmatively and omitted when absent, exactly as `assets.searchProjectCatalogue`
   * does: an empty list of kinds is not "everything of no kind", it is a question the API does
   * not answer.
   */
  it('passes only the narrowings it was given', async () => {
    const browse = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    await runAction('cloud.browseAccountLibrary', {
      text: 'stone',
      types: ['skybox'],
      pageSize: 20,
    })
    expect(browse).toHaveBeenCalledWith({ text: 'stone', types: ['skybox'], pageSize: 20 })

    await runAction('cloud.browseAccountLibrary', {})
    expect(browse).toHaveBeenLastCalledWith({})
  })

  it('carries the order a client asks its search to come back in', async () => {
    const browse = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    await runAction('cloud.browseAccountLibrary', { text: 'stone', order: 'relevance' })
    expect(browse).toHaveBeenCalledWith({ text: 'stone', order: 'relevance' })

    // An order nobody offers is refused rather than dropped, as a kind nobody has is: answering
    // a search the client did not ask for is worse than telling it the word means nothing here.
    expect(
      await runAction('cloud.browseAccountLibrary', { text: 'stone', order: 'cheapest' }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(browse).toHaveBeenCalledTimes(1)
  })

  it('refuses the fitting order when there is nothing to fit', async () => {
    // Relevance over an index nobody queried is not a ranking. Answered newest-first, the client
    // would present « what fits best » and be showing what is merely most recent.
    const browse = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    expect(
      await runAction('cloud.browseAccountLibrary', { tags: ['stone'], order: 'relevance' }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(browse).not.toHaveBeenCalled()
  })

  /**
   * The whole call, not the one bad item: `types` closes over the six kinds, and the registry
   * refuses a list holding anything else. Dropping it silently would have the client believe it
   * searched for a kind nobody looked up.
   */
  it('refuses a list holding a kind the studio does not have', async () => {
    const browse = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { browse } })

    expect(
      await runAction('cloud.browseAccountLibrary', { types: ['skybox', 'hologram'] }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(browse).not.toHaveBeenCalled()
  })

  it('reads the public feed of one kind, and refuses a kind that is not one', async () => {
    const explore = vi.fn(async () => ({ assets: [], cursor: null }))
    installFakeBridge({ cloud: { explore } })

    await runAction('cloud.explorePublicFeed', { type: 'image', cursor: 'page-2' })
    expect(explore).toHaveBeenCalledWith({ type: 'image', cursor: 'page-2' })

    expect(await runAction('cloud.explorePublicFeed', { type: 'hologram' })).toMatchObject({
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

    await runAction('cloud.previewSync', { assetIds: ['asset-1'], policy: 'two-way' })
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
