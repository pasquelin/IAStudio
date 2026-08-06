import { describe, expect, it, vi } from 'vitest'
import { createModelRegistry, type ModelCatalog, type RemoteModel } from './model-registry'

const FLUX: RemoteModel = {
  id: 'model_flux',
  name: 'Flux',
  capabilities: ['txt2img', 'img2img'],
  source: 'scenario',
  shortDescription: 'A fast image model',
  thumbnail: { url: 'https://cdn.example/flux.png' },
  inputs: [
    { name: 'prompt', type: 'string', prompt: true, required: { always: true } },
    { name: 'numInferenceSteps', type: 'number', min: 1, max: 50, default: 28 },
  ],
}

const VEO: RemoteModel = { id: 'model_veo', name: 'Veo', capabilities: ['txt2video'] }

function catalogOf(models: readonly RemoteModel[]): ModelCatalog {
  return {
    list: async function* () {
      yield* models
    },
    retrieve: modelId => {
      const model = models.find(candidate => candidate.id === modelId)
      return model ? Promise.resolve({ model }) : Promise.reject(new Error('unknown model'))
    },
  }
}

describe('model registry', () => {
  it('summarizes what the picker needs and infers the family', async () => {
    const registry = createModelRegistry({ catalog: () => catalogOf([FLUX]) })

    expect(await registry.list()).toEqual([
      {
        id: 'model_flux',
        name: 'Flux',
        family: 'image',
        source: 'scenario',
        description: 'A fast image model',
        thumbnail: 'https://cdn.example/flux.png',
      },
    ])
  })

  it('falls back to the id and to an unknown origin rather than dropping a model', async () => {
    const registry = createModelRegistry({ catalog: () => catalogOf([{ id: 'model_bare' }]) })

    expect(await registry.list()).toEqual([
      { id: 'model_bare', name: 'model_bare', family: 'other', source: 'other' },
    ])
  })

  it('filters by family without fetching a second time', async () => {
    const catalog = vi.fn(() => catalogOf([FLUX, VEO]))
    const registry = createModelRegistry({ catalog })

    expect(await registry.list('video')).toEqual([expect.objectContaining({ id: 'model_veo' })])
    expect(await registry.list('image')).toEqual([expect.objectContaining({ id: 'model_flux' })])
    expect(catalog).toHaveBeenCalledOnce()
  })

  // The catalogue is walked once per privacy, so the same model can be yielded twice.
  it('lists a model once even when the catalogue yields it twice', async () => {
    const registry = createModelRegistry({ catalog: () => catalogOf([FLUX, VEO, FLUX]) })

    expect((await registry.list()).map(summary => summary.id)).toEqual(['model_flux', 'model_veo'])
  })

  it('walks every page the catalogue yields', async () => {
    const many = Array.from({ length: 250 }, (_, index) => ({ id: `model_${index}` }))
    const registry = createModelRegistry({ catalog: () => catalogOf(many) })

    expect(await registry.list()).toHaveLength(250)
  })

  it('refetches once the cache has expired', async () => {
    let clock = 0
    const catalog = vi.fn(() => catalogOf([FLUX]))
    const registry = createModelRegistry({ catalog, ttlMs: 1000, now: () => clock })

    await registry.list()
    clock = 999
    await registry.list()
    expect(catalog).toHaveBeenCalledOnce()

    clock = 1001
    await registry.list()
    expect(catalog).toHaveBeenCalledTimes(2)
  })

  it('drops both caches when the credentials change', async () => {
    const catalog = vi.fn(() => catalogOf([FLUX]))
    const registry = createModelRegistry({ catalog })

    await registry.list()
    await registry.describe('model_flux')
    registry.invalidate()

    await registry.list()
    await registry.describe('model_flux')
    expect(catalog).toHaveBeenCalledTimes(4)
  })

  it('describes a model by translating its inputs into descriptors', async () => {
    const registry = createModelRegistry({ catalog: () => catalogOf([FLUX]) })
    const descriptor = await registry.describe('model_flux')

    expect(descriptor.name).toBe('Flux')
    expect(descriptor.fields).toEqual([
      { key: 'prompt', kind: 'longText', label: 'Prompt', required: true },
      {
        key: 'numInferenceSteps',
        kind: 'integer',
        label: 'Num inference steps',
        required: false,
        default: 28,
        min: 1,
        max: 50,
      },
    ])
  })

  it('describes a model with no inputs as a form with no field, not as a failure', async () => {
    const registry = createModelRegistry({ catalog: () => catalogOf([VEO]) })
    await expect(registry.describe('model_veo')).resolves.toMatchObject({ fields: [] })
  })

  it('describes each model once', async () => {
    const catalog = vi.fn(() => catalogOf([FLUX]))
    const registry = createModelRegistry({ catalog })

    await registry.describe('model_flux')
    await registry.describe('model_flux')
    expect(catalog).toHaveBeenCalledOnce()
  })
})
