import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from './assets'
import { failedCount, useCloud } from './cloud'

describe('moving assets between the project and the library', () => {
  beforeEach(() => {
    useCloud.getState().clear()
  })

  it('reports what each asset did', async () => {
    installFakeBridge({
      cloud: {
        push: () =>
          Promise.resolve([
            { assetId: 'a', ok: true },
            { assetId: 'b', ok: false, error: 'upload-too-large' },
          ]),
      },
    })

    await useCloud.getState().push(['a', 'b'])

    expect(failedCount(useCloud.getState())).toBe(1)
  })

  it('says the catalogue changed once a push is over', async () => {
    installFakeBridge({ cloud: { push: () => Promise.resolve([{ assetId: 'a', ok: true }]) } })
    const invalidate = vi.spyOn(useAssets.getState(), 'invalidate')

    await useCloud.getState().push(['a'])

    // The rows now carry a twin and a new sync state: what is on screen is stale.
    expect(invalidate).toHaveBeenCalled()
  })

  it('refuses to start a second run over the first', async () => {
    let calls = 0
    installFakeBridge({
      cloud: {
        push: () => {
          calls += 1
          return new Promise(resolve => setTimeout(() => resolve([]), 5))
        },
      },
    })

    const first = useCloud.getState().push(['a'])
    await useCloud.getState().push(['b'])
    await first

    expect(calls).toBe(1)
  })

  it('does nothing at all when nothing is selected', async () => {
    let called = false
    installFakeBridge({
      cloud: {
        push: () => {
          called = true
          return Promise.resolve([])
        },
      },
    })

    await useCloud.getState().push([])
    expect(called).toBe(false)
  })

  it('marks the whole run as failed when the boundary itself refuses', async () => {
    // A rejection here is a bad request or no project — not a per-asset failure, which comes
    // back inside `outcomes` instead.
    installFakeBridge({ cloud: { push: () => Promise.reject(new Error('no project')) } })

    await useCloud.getState().push(['a', 'b'])

    expect(failedCount(useCloud.getState())).toBe(2)
    expect(useCloud.getState().busy).toBe(false)
  })

  it('reports what each fetch did, exactly as a push does', async () => {
    installFakeBridge({
      cloud: {
        pull: () =>
          Promise.resolve([
            { assetId: 'remote_1', ok: true },
            { assetId: 'remote_2', ok: false, error: 'not-found' },
          ]),
      },
    })

    await useCloud.getState().pull(['remote_1', 'remote_2'])

    // A download that fails halfway has already written the ones before it to disk.
    expect(failedCount(useCloud.getState())).toBe(1)
  })

  it('lets the shelf go again after a failure', async () => {
    installFakeBridge({ cloud: { pull: () => Promise.reject(new Error('offline')) } })

    await useCloud.getState().pull(['remote_1'])

    expect(failedCount(useCloud.getState())).toBe(1)
    expect(useCloud.getState().busy).toBe(false)
  })

  it('plans without moving anything', async () => {
    const summary = { push: 2, pull: 0, conflict: 0, skip: 1 }
    installFakeBridge({ cloud: { plan: () => Promise.resolve({ actions: [], summary }) } })

    const plan = await useCloud.getState().plan(['a', 'b', 'c'], 'push')
    expect(plan?.summary).toEqual(summary)
  })

  it('has no plan to give for an empty selection', async () => {
    installFakeBridge()
    expect(await useCloud.getState().plan([], 'push')).toBeNull()
  })
})

describe('what the shelf is told while a transfer is in flight', () => {
  beforeEach(() => {
    useCloud.getState().clear()
    vi.useRealTimers()
  })

  // `busy` says the studio is transferring; it cannot say WHICH tile to mark, and a shelf that
  // dimmed every cell during one download would be lying about nine of them.
  it('names the ids it is moving, not just that it is busy', async () => {
    const seen: string[][] = []
    installFakeBridge({
      cloud: {
        pull: () => {
          seen.push([...useCloud.getState().moving])
          return Promise.resolve([{ assetId: 'asset_remote', ok: true }])
        },
      },
    })

    await useCloud.getState().pull(['asset_remote'])

    expect(seen).toEqual([['asset_remote']])
  })

  /**
   * The floor exists because a 45 Ko picture is fetched in about 200 ms — measured — which is
   * under the time it takes to read a mark appearing. It is a floor on the SIGN alone: `busy`
   * has to drop at once, or the next transfer would wait on a delay that exists to be seen.
   */
  it('frees the studio at once while the mark stays up', async () => {
    vi.useFakeTimers()
    installFakeBridge({
      cloud: { pull: () => Promise.resolve([{ assetId: 'asset_remote', ok: true }]) },
    })

    await useCloud.getState().pull(['asset_remote'])

    expect(useCloud.getState().busy).toBe(false)
    expect(useCloud.getState().moving).toEqual(['asset_remote'])

    await vi.advanceTimersByTimeAsync(600)
    expect(useCloud.getState().moving).toEqual([])

    vi.useRealTimers()
  })
})

describe('bringing one library asset in', () => {
  beforeEach(() => {
    useCloud.getState().clear()
    useAssets.setState({ items: [] })
  })

  /**
   * The join this exists for: `pull` answers in the library's ids, and every caller downstream —
   * opening a tab, dropping onto a canvas — needs the catalogue row the import wrote. The two
   * vocabularies meet on `remoteAssetId` and nowhere else.
   */
  it('hands back the catalogue row, not the library id it was given', async () => {
    const row: Asset = {
      id: 'asset_local',
      name: 'skeleton',
      type: 'mesh',
      location: 'local',
      remoteAssetId: 'asset_remote',
      tags: [],
      createdAt: '2026-08-12T11:00:00.000Z',
    }
    installFakeBridge({
      cloud: { pull: () => Promise.resolve([{ assetId: 'asset_remote', ok: true }]) },
      assets: { search: () => Promise.resolve([row]) },
    })

    expect(await useCloud.getState().fetchOne('asset_remote')).toMatchObject({ id: 'asset_local' })
  })

  // A refusal opens nothing rather than guessing: the journal already says why, and a caller
  // that received a row that was never written would open an empty document.
  it('answers nothing when the transfer brought nothing back', async () => {
    installFakeBridge({
      cloud: { pull: () => Promise.resolve([{ assetId: 'asset_remote', ok: false }]) },
      assets: { search: () => Promise.resolve([]) },
    })

    expect(await useCloud.getState().fetchOne('asset_remote')).toBeNull()
  })
})
