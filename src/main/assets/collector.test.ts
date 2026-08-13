import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { createAssetCollector, type RemoteAsset } from './collector'
import type { ImportRequest, LocalBackend } from './local-backend'

const JOB: Job = {
  id: 'job_1',
  kind: 'model',
  targetId: 'model_flux',
  label: 'Flux',
  status: 'running',
  progress: 1,
  createdAt: '2026-08-06T10:00:00.000Z',
  assetIds: [],
}

function backendSpy(): { backend: LocalBackend; imported: ImportRequest[] } {
  const imported: ImportRequest[] = []
  const backend: LocalBackend = {
    // The collector only ever downloads; the two write paths belong to the audio editor.
    importFromBytes: () => Promise.reject(new Error('not used by the collector')),
    replaceBytes: () => Promise.reject(new Error('not used by the collector')),
    importFromUrl: request => {
      imported.push(request)
      const asset: Asset = {
        id: request.id,
        name: request.name,
        type: request.type,
        location: 'local',
        tags: [],
        createdAt: JOB.createdAt,
      }
      return Promise.resolve(asset)
    },
  }
  return { backend, imported }
}

describe('asset collector', () => {
  const remote = (kind: string): RemoteAsset => ({ url: `https://cdn.example/x.${kind}`, kind })

  it('names a single output after the job', async () => {
    const { backend, imported } = backendSpy()
    let sequence = 0
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('image')),
      backend,
      newId: () => `asset_${++sequence}`,
      heldFor: async () => null,
    })

    expect(await collect(JOB, ['remote_1'])).toMatchObject({ ids: ['asset_1'] })
    expect(imported[0]).toMatchObject({ name: 'Flux', type: 'image', jobId: 'job_1' })
  })

  it('numbers the outputs when a generation returns several', async () => {
    const { backend, imported } = backendSpy()
    let sequence = 0
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('image')),
      backend,
      newId: () => `asset_${++sequence}`,
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1', 'remote_2'])
    expect(imported.map(request => request.name)).toEqual(['Flux 1', 'Flux 2'])
  })

  it('skips a non-media output instead of failing the job over it', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: remoteAssetId =>
        Promise.resolve(remote(remoteAssetId === 'remote_caption' ? 'json' : 'image')),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    expect(await collect(JOB, ['remote_caption', 'remote_image'])).toMatchObject({
      ids: ['asset_1'],
    })
    expect(imported).toHaveLength(1)
  })

  it('remembers which remote asset each local one came from', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('3d')),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]).toMatchObject({ remoteAssetId: 'remote_1', type: 'mesh' })
  })

  /**
   * A mesh generated here is a tile in the browser a second later, and its `.glb` is not a
   * picture. The API renders a still for exactly that, and dropping it leaves the shelf showing
   * an icon for every model the studio makes.
   */
  it('carries the still the API rendered for what cannot show itself', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () =>
        Promise.resolve({ ...remote('3d'), thumbnailUrl: 'https://cdn.example/thumbnails/x' }),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]?.thumbnailUrl).toBe('https://cdn.example/thumbnails/x')
  })

  it('carries none when the API rendered none', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('3d')),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]?.thumbnailUrl).toBeUndefined()
  })

  // One converter job answers with several pictures. Filed as plain images, the material
  // would be lost: the channel a picture carries is what makes it part of one.
  it('files a PBR channel as a texture, whatever its kind says', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve({ ...remote('image'), metadataType: 'texture-normal' }),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]).toMatchObject({ type: 'texture', map: 'normal' })
    expect(imported[0]?.mapInverted).toBeUndefined()
  })

  it('remembers that a smoothness map reads the other way round', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve({ ...remote('image'), metadataType: 'texture-smoothness' }),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]).toMatchObject({ map: 'roughness', mapInverted: true })
  })

  // Without this the seven channels of one job land as seven unrelated assets, and the
  // material they belong to cannot be put back together.
  it('hangs a channel from the local asset its parent became', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () =>
        Promise.resolve({
          ...remote('image'),
          metadataType: 'texture-normal',
          parentId: 'remote_source',
        }),
      backend,
      newId: () => 'asset_1',
      heldFor: async remoteAssetId =>
        remoteAssetId === 'remote_source' ? { id: 'asset_source', type: 'image' } : null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]?.derivedFrom).toBe('asset_source')
  })

  it('leaves a channel unattached when its parent never entered the project', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () =>
        Promise.resolve({
          ...remote('image'),
          metadataType: 'texture-normal',
          parentId: 'remote_never_imported',
        }),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]?.derivedFrom).toBeUndefined()
  })

  it('leaves an ordinary generation without a channel', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve({ ...remote('image'), metadataType: 'inference-txt2img' }),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]?.type).toBe('image')
    expect(imported[0]?.map).toBeUndefined()
  })

  it('downloads one output at a time', async () => {
    const { backend } = backendSpy()
    let active = 0
    let peak = 0

    const collect = createAssetCollector({
      retrieve: vi.fn(async () => {
        peak = Math.max(peak, ++active)
        await Promise.resolve()
        active--
        return remote('image')
      }),
      backend,
      newId: () => 'asset_1',
      heldFor: async () => null,
    })

    await collect(JOB, ['a', 'b', 'c'])
    expect(peak).toBe(1)
  })

  it('reuses what this job already put in the project instead of downloading it again', async () => {
    const { backend, imported } = backendSpy()
    const retrieve = vi.fn(() => Promise.resolve(remote('image')))

    const collect = createAssetCollector({
      retrieve,
      backend,
      newId: () => 'asset_new',
      heldFor: async () => ({ id: 'asset_already_here', jobId: JOB.id, type: 'image' }),
    })

    expect(await collect(JOB, ['remote_1'])).toMatchObject({ ids: ['asset_already_here'] })
    expect(retrieve).not.toHaveBeenCalled()
    expect(imported).toEqual([])
  })

  it('collects its own output even when the library already holds a copy from elsewhere', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('image')),
      backend,
      newId: () => 'asset_generated',
      heldFor: async () => ({ id: 'asset_pulled_from_cloud', type: 'image' }),
    })

    expect(await collect(JOB, ['remote_1'])).toMatchObject({ ids: ['asset_generated'] })
    expect(imported[0]).toMatchObject({ jobId: JOB.id, name: 'Flux' })
  })
})

describe('what the collector records about a generation', () => {
  const collectorOn = (assets: Record<string, RemoteAsset>) => {
    const { backend, imported: seen } = backendSpy()
    let next = 0
    return {
      collect: createAssetCollector({
        retrieve: id => Promise.resolve(assets[id] ?? { url: 'https://cdn/x.png', kind: 'image' }),
        backend,
        newId: () => `asset_${(next += 1)}`,
        heldFor: () => Promise.resolve(null),
      }),
      seen,
    }
  }

  it('carries the model, prompt and seed the API reported', async () => {
    const generation = {
      modelId: 'model_flux',
      modelLabel: 'Flux',
      prompt: 'mossy boulder',
      params: { guidance: 3.5 },
      seed: 7,
    }
    const { collect, seen } = collectorOn({
      remote_1: { url: 'https://cdn/a.png', kind: 'image', generation },
    })

    await collect(JOB, ['remote_1'])
    expect(seen[0]?.generation).toEqual(generation)
  })

  it('carries the twin its project and its timestamp', async () => {
    const { collect, seen } = collectorOn({
      remote_1: {
        url: 'https://cdn/a.png',
        kind: 'image',
        ownerId: 'proj_a',
        updatedAt: '2026-08-06T09:00:00.000Z',
      },
    })

    await collect(JOB, ['remote_1'])
    expect(seen[0]).toMatchObject({
      remoteOwnerId: 'proj_a',
      remoteUpdatedAt: '2026-08-06T09:00:00.000Z',
    })
  })

  it('ties the outputs of one job together and keeps their order', async () => {
    const { collect, seen } = collectorOn({
      remote_1: { url: 'https://cdn/a.png', kind: 'image', metadataType: 'texture-albedo' },
      remote_2: { url: 'https://cdn/b.png', kind: 'image', metadataType: 'texture-normal' },
    })

    await collect(JOB, ['remote_1', 'remote_2'])
    expect(seen.map(one => [one.groupId, one.outputIndex, one.map])).toEqual([
      ['job_1', 0, 'baseColor'],
      ['job_1', 1, 'normal'],
    ])
  })

  it('leaves a lone output ungrouped, because one asset is not a set', async () => {
    const { collect, seen } = collectorOn({})

    await collect(JOB, ['remote_1'])
    expect(seen[0]?.groupId).toBeUndefined()
    expect(seen[0]?.outputIndex).toBeUndefined()
  })

  it('files an LDR skybox as a skybox rather than as a picture', async () => {
    const { collect, seen } = collectorOn({
      remote_1: { url: 'https://cdn/a.png', kind: 'image', metadataType: 'skybox-base-360' },
    })

    await collect(JOB, ['remote_1'])
    expect(seen[0]?.type).toBe('skybox')
  })
})
