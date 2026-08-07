import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { assetTypeOf, createAssetCollector, type RemoteAsset } from './collector'
import type { ImportRequest, LocalBackend } from './local-backend'

const JOB: Job = {
  id: 'job_1',
  modelId: 'model_flux',
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

describe('asset kinds', () => {
  it('maps each media kind onto a studio type', () => {
    expect(assetTypeOf('image')).toBe('image')
    expect(assetTypeOf('image-hdr')).toBe('skybox')
    expect(assetTypeOf('video')).toBe('video')
    expect(assetTypeOf('audio')).toBe('audio')
    expect(assetTypeOf('3d')).toBe('mesh')
  })

  it('rejects what is data about an asset rather than an asset', () => {
    expect(assetTypeOf('json')).toBeNull()
    expect(assetTypeOf('text')).toBeNull()
    expect(assetTypeOf('document')).toBeNull()
    expect(assetTypeOf('something-new')).toBeNull()
  })
})

describe('asset collector', () => {
  const remote = (kind: string): RemoteAsset => ({ url: `https://cdn.example/x.${kind}`, kind })

  it('names a single output after the job', async () => {
    const { backend, imported } = backendSpy()
    let sequence = 0
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('image')),
      backend,
      newId: () => `asset_${++sequence}`,
      localIdOf: async () => null,
    })

    expect(await collect(JOB, ['remote_1'])).toEqual(['asset_1'])
    expect(imported[0]).toMatchObject({ name: 'Flux', type: 'image', jobId: 'job_1' })
  })

  it('numbers the outputs when a generation returns several', async () => {
    const { backend, imported } = backendSpy()
    let sequence = 0
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('image')),
      backend,
      newId: () => `asset_${++sequence}`,
      localIdOf: async () => null,
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
      localIdOf: async () => null,
    })

    expect(await collect(JOB, ['remote_caption', 'remote_image'])).toEqual(['asset_1'])
    expect(imported).toHaveLength(1)
  })

  it('remembers which remote asset each local one came from', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve(remote('3d')),
      backend,
      newId: () => 'asset_1',
      localIdOf: async () => null,
    })

    await collect(JOB, ['remote_1'])
    expect(imported[0]).toMatchObject({ remoteAssetId: 'remote_1', type: 'mesh' })
  })

  // One converter job answers with several pictures. Filed as plain images, the material
  // would be lost: the channel a picture carries is what makes it part of one.
  it('files a PBR channel as a texture, whatever its kind says', async () => {
    const { backend, imported } = backendSpy()
    const collect = createAssetCollector({
      retrieve: () => Promise.resolve({ ...remote('image'), metadataType: 'texture-normal' }),
      backend,
      newId: () => 'asset_1',
      localIdOf: async () => null,
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
      localIdOf: async () => null,
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
      localIdOf: async remoteAssetId => (remoteAssetId === 'remote_source' ? 'asset_source' : null),
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
      localIdOf: async () => null,
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
      localIdOf: async () => null,
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
      localIdOf: async () => null,
    })

    await collect(JOB, ['a', 'b', 'c'])
    expect(peak).toBe(1)
  })
})
