import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { createAssetInputResolver } from './assetInputs'

const asset = (id: string, extra: Partial<Asset> = {}): Asset => ({
  id,
  name: id,
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-09T10:00:00.000Z',
  ...extra,
})

function resolverOver(assets: readonly Asset[], activeOwnerId: string | null = null) {
  const held = new Map(assets.map(one => [one.id, one]))
  const push = vi.fn(async (assetId: string) => {
    const found = held.get(assetId)
    if (!found) throw new Error(`unknown ${assetId}`)
    const pushed = { ...found, remoteAssetId: `remote-of-${assetId}` }
    held.set(assetId, pushed)
    return pushed
  })
  const find = vi.fn(async (assetId: string) => held.get(assetId) ?? null)

  return {
    resolve: createAssetInputResolver({ find, push, activeOwnerId: () => activeOwnerId }),
    find,
    push,
  }
}

describe('createAssetInputResolver', () => {
  it('rewrites a local asset id into the id Scenario knows it by', async () => {
    const { resolve, push } = resolverOver([
      asset('asset_local', { remoteAssetId: 'asset_remote' }),
    ])

    expect(await resolve.resolveBody({ image: 'asset_local' })).toEqual({ image: 'asset_remote' })
    expect(push).not.toHaveBeenCalled()
  })

  it('sends an asset the account has never seen, then names the twin it became', async () => {
    const { resolve, push } = resolverOver([asset('asset_local')])

    expect(await resolve.resolveBody({ image: 'asset_local' })).toEqual({
      image: 'remote-of-asset_local',
    })
    expect(push).toHaveBeenCalledWith('asset_local')
  })

  it('leaves a value the catalogue does not hold as it stands', async () => {
    const { resolve, push } = resolverOver([])

    const body = { prompt: 'a fox', image: 'https://example.test/fox.png', seed: 4 }
    expect(await resolve.resolveBody(body)).toEqual(body)
    expect(push).not.toHaveBeenCalled()
  })

  it('rewrites every entry of a list of pictures', async () => {
    const { resolve } = resolverOver([
      asset('asset_a', { remoteAssetId: 'asset_ra' }),
      asset('asset_b', { remoteAssetId: 'asset_rb' }),
    ])

    expect(
      await resolve.resolveBody({ referenceImages: ['asset_a', 'unknown', 'asset_b'] }),
    ).toEqual({
      referenceImages: ['asset_ra', 'unknown', 'asset_rb'],
    })
  })

  it('reaches a value nested under an object', async () => {
    const { resolve } = resolverOver([asset('asset_local', { remoteAssetId: 'asset_remote' })])

    expect(await resolve.resolveBody({ layers: { base: 'asset_local' } })).toEqual({
      layers: { base: 'asset_remote' },
    })
  })

  // Two nodes of one graph feeding from the same dropped picture: sent twice, the transfer is
  // paid twice and the account gains two twins of one file.
  it('sends an asset named twice in one body only once', async () => {
    const { resolve, push } = resolverOver([asset('asset_local')])

    expect(await resolve.resolveBody({ image: 'asset_local', mask: 'asset_local' })).toEqual({
      image: 'remote-of-asset_local',
      mask: 'remote-of-asset_local',
    })
    expect(push).toHaveBeenCalledTimes(1)
  })

  // An id typed or pasted from the webapp: it is already the one the API answers to, and no
  // local row will ever hold it.
  it('leaves an asset id the catalogue has no row for as it stands', async () => {
    const { resolve, push } = resolverOver([])

    expect(await resolve.resolveBody({ image: 'asset_rDVkmKpz3eN41aDsqMNXPbCT' })).toEqual({
      image: 'asset_rDVkmKpz3eN41aDsqMNXPbCT',
    })
    expect(push).not.toHaveBeenCalled()
  })

  // A key carries its own project, so an id recorded under another one means nothing here —
  // the API answers 404, and no retry repairs a 404.
  it('sends an asset again when its twin lives in another project', async () => {
    const { resolve, push } = resolverOver(
      [asset('asset_local', { remoteAssetId: 'asset_elsewhere', remoteOwnerId: 'proj_other' })],
      'proj_here',
    )

    expect(await resolve.resolveBody({ image: 'asset_local' })).toEqual({
      image: 'remote-of-asset_local',
    })
    expect(push).toHaveBeenCalledWith('asset_local')
  })

  // The quieter of the two: the run succeeds, on a picture the user edited and no longer sees.
  it('sends an asset again when it was edited after it went up', async () => {
    const { resolve, push } = resolverOver([
      asset('asset_local', {
        remoteAssetId: 'asset_stale',
        remoteSyncedAt: '2026-08-09T10:00:00.000Z',
        localChangedAt: '2026-08-09T11:00:00.000Z',
      }),
    ])

    expect(await resolve.resolveBody({ image: 'asset_local' })).toEqual({
      image: 'remote-of-asset_local',
    })
    expect(push).toHaveBeenCalledWith('asset_local')
  })

  it('keeps the twin of an asset untouched since it went up', async () => {
    const { resolve, push } = resolverOver([
      asset('asset_local', {
        remoteAssetId: 'asset_remote',
        remoteSyncedAt: '2026-08-09T11:00:00.000Z',
        localChangedAt: '2026-08-09T10:00:00.000Z',
      }),
    ])

    expect(await resolve.resolveBody({ image: 'asset_local' })).toEqual({ image: 'asset_remote' })
    expect(push).not.toHaveBeenCalled()
  })

  /**
   * The job loop runs two at a time: relaunching a generation while the first still holds the
   * same never-sent picture had both look, both find no twin, and both send the file — paid for
   * twice, and two twins in a library that can only record one.
   */
  it('sends an asset named by two bodies at once only once', async () => {
    const { resolve, push } = resolverOver([asset('asset_local')])

    const [first, second] = await Promise.all([
      resolve.resolveBody({ image: 'asset_local' }),
      resolve.resolveBody({ mask: 'asset_local' }),
    ])

    expect(first).toEqual({ image: 'remote-of-asset_local' })
    expect(second).toEqual({ mask: 'remote-of-asset_local' })
    expect(push).toHaveBeenCalledTimes(1)
  })

  // Or the second run of a picture whose first attempt failed would be answered from the failure.
  it('sends an asset again after a transfer that failed', async () => {
    const find = async (): Promise<Asset> => asset('asset_local')
    let attempts = 0
    const push = async (): Promise<Asset> => {
      attempts += 1
      if (attempts === 1) throw new Error('offline')
      return asset('asset_local', { remoteAssetId: 'asset_remote' })
    }
    const resolve = createAssetInputResolver({ find, push, activeOwnerId: () => null })

    await expect(resolve.resolveBody({ image: 'asset_local' })).rejects.toThrow('offline')
    expect(await resolve.resolveBody({ image: 'asset_local' })).toEqual({ image: 'asset_remote' })
  })

  it('refuses a submission when a sent asset came back without a twin', async () => {
    const find = async (): Promise<Asset> => asset('asset_local')
    const push = async (): Promise<Asset> => asset('asset_local')
    const resolve = createAssetInputResolver({ find, push, activeOwnerId: () => null })

    await expect(resolve.resolveBody({ image: 'asset_local' })).rejects.toThrow('asset_local')
  })

  it('does not ask the catalogue about a value no local id could look like', async () => {
    const { resolve, find } = resolverOver([])

    await resolve.resolveBody({ prompt: 'a fox in the snow', steps: 30 })
    expect(find).not.toHaveBeenCalled()
  })

  // Letting it through would submit an id the API cannot resolve: a generation paid for and
  // failed, reported as whatever the model makes of a reference it never received.
  it('fails the submission when an asset cannot be sent', async () => {
    const find = async (): Promise<Asset> => asset('asset_local')
    const push = async (): Promise<Asset> => {
      throw new Error('the API does not accept image/tiff')
    }
    const resolve = createAssetInputResolver({ find, push, activeOwnerId: () => null })

    await expect(resolve.resolveBody({ image: 'asset_local' })).rejects.toThrow('image/tiff')
  })

  it('survives a body that holds itself', async () => {
    const { resolve } = resolverOver([asset('asset_local', { remoteAssetId: 'asset_remote' })])
    const body: Record<string, unknown> = { image: 'asset_local' }
    body.itself = body

    const resolved = await resolve.resolveBody(body)
    expect(resolved.image).toBe('asset_remote')
  })
})

describe('resolvePictureIds', () => {
  it('rewrites every local id of a list, in the order it was given', async () => {
    const { resolve } = resolverOver([
      asset('asset_a', { remoteAssetId: 'asset_ra' }),
      asset('asset_b', { remoteAssetId: 'asset_rb' }),
    ])

    await expect(resolve.resolvePictureIds(['asset_a', 'asset_b'])).resolves.toEqual([
      'asset_ra',
      'asset_rb',
    ])
  })

  it('sends a picture the account has never seen, then names the twin it became', async () => {
    const { resolve, push } = resolverOver([asset('asset_local')])

    await expect(resolve.resolvePictureIds(['asset_local'])).resolves.toEqual([
      'remote-of-asset_local',
    ])
    expect(push).toHaveBeenCalledWith('asset_local')
  })

  /**
   * The hole this door does NOT close, pinned so it cannot be lost: both vocabularies share the
   * `asset_` prefix, so an id no row answers to is indistinguishable from one pasted from the
   * webapp. Drop a picture on the form, delete it from the assets panel, then click — the local
   * id goes out and the API answers as though no reference had been given.
   */
  it('lets an id the catalogue no longer answers to go out as it stands', async () => {
    const { resolve, push } = resolverOver([])

    await expect(resolve.resolvePictureIds(['asset_deleted'])).resolves.toEqual(['asset_deleted'])
    expect(push).not.toHaveBeenCalled()
  })

  // What the form hands over is either kind, and the field cannot say which — see
  // `referencePictures`. A data URL is already something the API reads.
  it('leaves a data URL as it stands, without asking the catalogue', async () => {
    const { resolve, find, push } = resolverOver([])

    await expect(resolve.resolvePictureIds(['data:image/png;base64,iVBOR'])).resolves.toEqual([
      'data:image/png;base64,iVBOR',
    ])
    expect(find).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  // Not dropped: a style read from two of three pictures, worded as though it had seen all
  // three, is the silent wrongness this whole path exists to close.
  it('fails the whole call when one picture cannot be sent', async () => {
    const find = async (): Promise<Asset> => asset('asset_local')
    const push = async (): Promise<Asset> => {
      throw new Error('the API does not accept image/tiff')
    }
    const resolve = createAssetInputResolver({ find, push, activeOwnerId: () => null })

    await expect(resolve.resolvePictureIds(['asset_local'])).rejects.toThrow('image/tiff')
  })

  // The two doors share one in-flight map, which is the whole reason they are one translator:
  // assisting on a picture a generation is still sending would otherwise send it twice.
  it('sends an asset named by a body and a picture list at once only once', async () => {
    const { resolve, push } = resolverOver([asset('asset_local')])

    const [body, pictures] = await Promise.all([
      resolve.resolveBody({ image: 'asset_local' }),
      resolve.resolvePictureIds(['asset_local']),
    ])

    expect(body).toEqual({ image: 'remote-of-asset_local' })
    expect(pictures).toEqual(['remote-of-asset_local'])
    expect(push).toHaveBeenCalledTimes(1)
  })

  // A key carries its own project: an id twinned under another account names nothing here.
  it('sends again a twin recorded under another project', async () => {
    const { resolve, push } = resolverOver(
      [asset('asset_local', { remoteAssetId: 'asset_remote', remoteOwnerId: 'other-project' })],
      'this-project',
    )

    await expect(resolve.resolvePictureIds(['asset_local'])).resolves.toEqual([
      'remote-of-asset_local',
    ])
    expect(push).toHaveBeenCalledWith('asset_local')
  })
})
