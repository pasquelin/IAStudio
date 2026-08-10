import { describe, expect, it, vi } from 'vitest'
import { OFFICIAL_TAG, SKYBOX_TAG } from '@shared/domain/model'
import { createCredentialsWatch } from './credentials-watch'
import {
  createModelRegistry,
  type ListRequest,
  type ModelCatalog,
  type ModelRegistry,
  type RegistryOptions,
  type RemoteModel,
  type SearchRequest,
} from './model-registry'

/** The account switch is its own subject, below: everything else is built deaf to it. */
const registryOf = (options: Omit<RegistryOptions, 'watch'>): ModelRegistry =>
  createModelRegistry({ ...options, watch: () => () => {} })

const FLUX: RemoteModel = {
  id: 'model_flux',
  name: 'Flux',
  capabilities: ['txt2img', 'img2img'],
  source: 'scenario',
  tags: [OFFICIAL_TAG, 'Image'],
  shortDescription: 'A fast image model',
  thumbnail: { url: 'https://cdn.example/flux.png' },
  createdAt: '2026-01-02T00:00:00.000Z',
  inputs: [
    { name: 'prompt', type: 'string', prompt: true, required: { always: true } },
    { name: 'numInferenceSteps', type: 'number', min: 1, max: 50, default: 28 },
  ],
}

const VEO: RemoteModel = { id: 'model_veo', name: 'Veo', capabilities: ['txt2video'] }

/** Shaped after `model_scenario-skybox-flux`: a panorama model answers the image capabilities. */
const SKY: RemoteModel = {
  id: 'model_sky',
  name: 'Scenario Skybox Flux.1',
  capabilities: ['txt2img', 'img2img'],
  tags: [SKYBOX_TAG, 'panorama'],
}

/** Shaped after `model_ideogram-remove-background`: a cutout model answers `img2img` too. */
const CUTOUT: RemoteModel = {
  id: 'model_cutout',
  name: 'Ideogram Remove Background',
  capabilities: ['img2img'],
  tags: [OFFICIAL_TAG, 'remove-background'],
}

type Catalogue = {
  private?: readonly RemoteModel[]
  public?: readonly RemoteModel[]
}

type Spied = {
  catalog: () => ModelCatalog
  lists: ListRequest[]
  searches: SearchRequest[]
  bulks: string[][]
}

/**
 * Stands in for the SDK, paginating the way the real endpoints do: a token into the catalogue,
 * an offset into the search index. The registry's whole job is to walk those two, so a fake
 * that answered everything in one page would test nothing.
 */
function spiedCatalog(catalogue: Catalogue): Spied {
  const lists: ListRequest[] = []
  const searches: SearchRequest[] = []
  const bulks: string[][] = []
  const everything = [...(catalogue.private ?? []), ...(catalogue.public ?? [])]

  const catalog = (): ModelCatalog => ({
    list: request => {
      lists.push(request)
      const held = (catalogue[request.privacy] ?? []).filter(
        model =>
          (!request.official || (model.tags ?? []).includes(OFFICIAL_TAG)) &&
          // Narrowed server-side, as the real endpoint does: a page fetched under a tag holds
          // fewer models than the same page without one, which is what makes it a page of its
          // own rather than a slice of the catalogue.
          (!request.tag || (model.tags ?? []).includes(request.tag)),
      )
      const start = request.token ? Number(request.token) : 0
      const models = held.slice(start, start + request.pageSize)
      const next = start + models.length
      return Promise.resolve({ models, token: next < held.length ? String(next) : null })
    },

    search: request => {
      searches.push(request)
      const hits = (catalogue.public ?? []).filter(model =>
        (model.name ?? '').toLowerCase().includes(request.query.toLowerCase()),
      )
      const models = hits.slice(request.offset, request.offset + request.limit)
      const next = request.offset + models.length
      return Promise.resolve({ models, token: next < hits.length ? String(next) : null })
    },

    retrieve: modelId => {
      const model = everything.find(candidate => candidate.id === modelId)
      return model ? Promise.resolve({ model }) : Promise.reject(new Error('unknown model'))
    },

    assetUrls: assetIds => {
      bulks.push([...assetIds])
      /**
       * Mirrors what the API really answers, per family: an image carries its picture in
       * `url`; a video carries an unusable `url` and a still in `thumbnail`; a text example
       * carries neither.
       */
      return Promise.resolve(
        assetIds.map(id => {
          if (id === 'asset_missing') return { id }
          if (id === 'asset_text') return { id, url: `https://cdn/${id}`, mimeType: 'text/plain' }
          if (id === 'asset_video') {
            return {
              id,
              url: `https://cdn/${id}`,
              mimeType: 'video/mp4',
              thumbnail: { url: `https://cdn/${id}-still` },
            }
          }
          return { id, url: `https://cdn/${id}`, mimeType: 'image/png' }
        }),
      )
    },
  })

  return { catalog, lists, searches, bulks }
}

function publicCatalog(models: readonly RemoteModel[]): () => ModelCatalog {
  return spiedCatalog({ public: models }).catalog
}

function manyModels(count: number, prefix = 'model'): RemoteModel[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_${index}`,
    name: `${prefix} ${index}`,
    capabilities: ['txt2img'],
  }))
}

describe('model registry', () => {
  it('summarizes what the panel needs and infers the family', async () => {
    const registry = registryOf({ catalog: publicCatalog([FLUX]) })

    expect((await registry.search({})).items).toEqual([
      {
        id: 'model_flux',
        name: 'Flux',
        family: 'image',
        source: 'scenario',
        origin: 'official',
        featured: false,
        capabilities: ['txt2img', 'img2img'],
        tags: [OFFICIAL_TAG, 'Image'],
        description: 'A fast image model',
        thumbnail: 'https://cdn.example/flux.png',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('falls back to the id and to an unknown origin rather than dropping a model', async () => {
    const registry = registryOf({ catalog: publicCatalog([{ id: 'model_bare' }]) })

    expect((await registry.search({})).items).toEqual([
      {
        id: 'model_bare',
        name: 'model_bare',
        family: 'other',
        source: 'other',
        origin: 'community',
        featured: false,
        capabilities: [],
        tags: [],
      },
    ])
  })

  /**
   * The grade decides whether the picker offers the model at all, so it has to survive both
   * projections. Grade 0 is the trap: it is the free tier, and a truthiness test drops it to
   * "ungraded" — which reads as allowed, silently, for every model the free plan does cover.
   */
  it('carries the plan grade through, zero included', async () => {
    const registry = registryOf({
      catalog: publicCatalog([
        { id: 'model_pro', accessRestrictions: 50 },
        { id: 'model_free', accessRestrictions: 0 },
        { id: 'model_ungraded' },
      ]),
    })

    const { items } = await registry.search({})

    expect(items.map(item => item.requiredPlanLevel)).toEqual([50, 0, undefined])
  })

  it('reads authorship from the official tag, the only signal the API carries', async () => {
    const registry = registryOf({ catalog: publicCatalog([FLUX, VEO]) })

    expect((await registry.search({ origin: 'community' })).items).toEqual([
      expect.objectContaining({ id: 'model_veo', origin: 'community' }),
    ])
  })

  it('filters by family across pages', async () => {
    const registry = registryOf({ catalog: publicCatalog([FLUX, VEO]) })

    expect((await registry.search({ family: 'video' })).items).toEqual([
      expect.objectContaining({ id: 'model_veo' }),
    ])
  })

  it('answers one page at a time rather than walking the whole catalogue', async () => {
    const spied = spiedCatalog({ public: manyModels(400) })
    const registry = registryOf({ catalog: spied.catalog })

    const first = await registry.search({ limit: 24 })

    expect(first.items).toHaveLength(24)
    expect(first.cursor).not.toBeNull()
    // The empty private pass, then one public page — not the four hundred models.
    expect(spied.lists).toHaveLength(2)
  })

  /**
   * A server page holds four screenfuls, and the cursor comes back into it. Fetching it again
   * for each one cost 33 requests to walk 8 distinct pages, and reparsed 2 500 records.
   */
  it('downloads a server page once, however many screenfuls it serves', async () => {
    const spied = spiedCatalog({ public: manyModels(400) })
    const registry = registryOf({ catalog: spied.catalog })

    const first = await registry.search({ limit: 24 })
    const second = await registry.search({ limit: 24, cursor: first.cursor ?? undefined })
    await registry.search({ limit: 24, cursor: second.cursor ?? undefined })

    // The empty private pass, then ONE public page serving all three screenfuls.
    expect(spied.lists).toHaveLength(2)
  })

  it('resumes where the cursor left off, without repeating a model', async () => {
    const registry = registryOf({ catalog: publicCatalog(manyModels(400)) })

    const first = await registry.search({ limit: 24 })
    const second = await registry.search({ limit: 24, cursor: first.cursor ?? undefined })
    const ids = new Set([...first.items, ...second.items].map(summary => summary.id))

    expect(ids.size).toBe(48)
  })

  /**
   * The walk covers the private listing then the public one, and `privacy: 'public'` includes
   * community models — so a model the user trained AND published comes out of both.
   */
  it('lists a model once even when both passes carry it', async () => {
    const mine = { ...FLUX, id: 'model_shared' }
    const registry = registryOf({
      catalog: spiedCatalog({ private: [mine], public: [mine, VEO] }).catalog,
    })

    const page = await registry.search({})

    expect(page.items.map(summary => summary.id)).toEqual(['model_shared', 'model_veo'])
  })

  it('reports the end of the catalogue with a null cursor', async () => {
    const registry = registryOf({ catalog: publicCatalog([FLUX, VEO]) })

    expect((await registry.search({})).cursor).toBeNull()
  })

  it('walks the private models first, then the public ones', async () => {
    const spied = spiedCatalog({ private: [VEO], public: [FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    const page = await registry.search({})

    expect(page.items.map(summary => summary.id)).toEqual(['model_veo', 'model_flux'])
    expect(spied.lists.map(request => request.privacy)).toEqual(['private', 'public'])
  })

  // A model the user trained is theirs, never Scenario's: that page could only be discarded.
  it('skips the private pass entirely when only official models are wanted', async () => {
    const spied = spiedCatalog({ private: [VEO], public: [FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    const page = await registry.search({ origin: 'official' })

    expect(page.items.map(summary => summary.id)).toEqual(['model_flux'])
    expect(spied.lists.every(request => request.privacy === 'public')).toBe(true)
  })

  /**
   * The API unions the tags it is given — `Video` alone answers 127 models, `Video,Kling` 139 —
   * so only one goes out, as a coarse narrowing, and the exact match is made locally.
   */
  it('sends one tag to the API as a coarse pre-filter', async () => {
    const spied = spiedCatalog({ public: [FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({ tags: ['I2V', 'Video'] })

    expect(spied.lists.at(-1)?.tag).toBe('I2V')
  })

  /**
   * Three models out of six hundred carry the tag, so the local filter alone would walk the
   * whole public catalogue to keep three rows. The chosen tag still wins: it is what the user
   * asked for, and the family narrows what comes back anyway.
   */
  it('asks the API for the skybox tag when the workspace wants that family', async () => {
    const spied = spiedCatalog({ public: [SKY] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({ family: 'skybox' })
    expect(spied.lists.at(-1)?.tag).toBe(SKYBOX_TAG)

    await registry.search({ family: 'skybox', tags: ['panorama'] })
    expect(spied.lists.at(-1)?.tag).toBe('panorama')

    await registry.search({ family: 'image' })
    expect(spied.lists.at(-1)?.tag).toBeUndefined()
  })

  /**
   * The three edit families are as sparse as the skyboxes and are found the same way. Measured:
   * nine models carry `remove-background`, ten `image-upscale`, four `vectorize`.
   */
  it('asks the API for the tag of every family one defines', async () => {
    const spied = spiedCatalog({ public: [CUTOUT] })
    const registry = registryOf({ catalog: spied.catalog })

    const cutouts = await registry.search({ family: 'background-removal' })
    expect(spied.lists.at(-1)?.tag).toBe('remove-background')
    expect(cutouts.items.map(item => item.id)).toEqual(['model_cutout'])

    await registry.search({ family: 'upscale' })
    expect(spied.lists.at(-1)?.tag).toBe('image-upscale')

    await registry.search({ family: 'vectorization' })
    expect(spied.lists.at(-1)?.tag).toBe('vectorize')
  })

  // The pre-filter makes a page family-specific, so the pages cache has to be too. Without the
  // family in its key, these three models answered the Image listing that came next.
  it('does not serve a skybox page back to another family', async () => {
    const spied = spiedCatalog({ public: [SKY, FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({ family: 'skybox' })
    const images = await registry.search({ family: 'image' })

    expect(images.items.map(item => item.id)).toEqual(['model_flux'])
  })

  // Resolved here, against the main process's clock: a date built in the renderer would move
  // on every render and make a new cache key each time.
  it('turns the requested span into a date, against its own clock', async () => {
    const spied = spiedCatalog({ public: [FLUX] })
    const noon = Date.parse('2026-08-06T12:00:00.000Z')
    const registry = registryOf({ catalog: spied.catalog, now: () => noon })

    await registry.search({ since: 'week' })

    expect(spied.lists.at(-1)?.createdAfter).toBe('2026-07-30T12:00:00.000Z')
  })

  it('asks for no date bound when no span is wanted', async () => {
    const spied = spiedCatalog({ public: [FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({})

    expect(spied.lists.at(-1)?.createdAfter).toBeUndefined()
  })

  it('pushes the official filter to the API instead of discarding pages client-side', async () => {
    const spied = spiedCatalog({ public: [FLUX, VEO] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({ origin: 'official' })

    expect(spied.lists[0]?.official).toBe(true)
  })

  /**
   * A filter the API cannot apply — family, capability — can empty page after page. The walk
   * has to stop and hand its cursor back, or one IPC call freezes the main process over the
   * whole catalogue.
   */
  it('bounds how many pages one request walks, and keeps its cursor', async () => {
    const spied = spiedCatalog({ public: manyModels(5000) })
    const registry = registryOf({ catalog: spied.catalog })

    const page = await registry.search({ family: 'video', limit: 24 })

    expect(page.items).toEqual([])
    expect(page.cursor).not.toBeNull()
    expect(spied.lists.length).toBeLessThanOrEqual(5)
  })

  it('sends a text query to the search index rather than sifting the catalogue', async () => {
    const spied = spiedCatalog({ public: [FLUX, VEO] })
    const registry = registryOf({ catalog: spied.catalog })

    const page = await registry.search({ search: 'flu' })

    expect(page.items.map(summary => summary.id)).toEqual(['model_flux'])
    expect(spied.searches).toHaveLength(1)
    expect(spied.lists).toHaveLength(0)
  })

  it('paginates the search index by offset', async () => {
    const spied = spiedCatalog({ public: manyModels(60, 'flux') })
    const registry = registryOf({ catalog: spied.catalog })

    const first = await registry.search({ search: 'flux', limit: 24 })
    await registry.search({ search: 'flux', limit: 24, cursor: first.cursor ?? undefined })

    expect(spied.searches.map(request => request.offset)).toEqual([0, 24])
  })

  it('serves an identical query from cache', async () => {
    const spied = spiedCatalog({ public: [FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({ family: 'image' })
    await registry.search({ family: 'image' })

    // Two calls, not one: an empty private pass still has to be walked before the public one.
    expect(spied.lists).toHaveLength(2)
  })

  it('refetches once the cache has expired', async () => {
    let clock = 0
    const spied = spiedCatalog({ public: [FLUX] })
    const registry = registryOf({ catalog: spied.catalog, ttlMs: 1000, now: () => clock })

    await registry.search({})
    clock = 999
    await registry.search({})
    expect(spied.lists).toHaveLength(2)

    clock = 1001
    await registry.search({})
    expect(spied.lists).toHaveLength(4)
  })

  /**
   * Subscribed where it is built, and reachable no other way: a public `invalidate` would let a
   * later caller drop this cache by hand and leave every other one holding the old account's
   * contents — which is the failure the watch exists to make impossible.
   */
  it('drops every cache on an account switch, without being told', async () => {
    const watch = createCredentialsWatch()
    const spied = spiedCatalog({ public: [FLUX] })
    const registry = createModelRegistry({ catalog: spied.catalog, watch: watch.watch })

    await registry.search({})
    await registry.previews(['asset_a'])
    watch.changed()

    await registry.search({})
    await registry.previews(['asset_a'])

    expect(spied.lists).toHaveLength(4)
    expect(spied.bulks).toHaveLength(2)
  })

  describe('previews', () => {
    it('resolves a whole screenful of cards in one request', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog })

      const resolved = await registry.previews(['asset_a', 'asset_b'])

      expect(resolved).toEqual({ asset_a: 'https://cdn/asset_a', asset_b: 'https://cdn/asset_b' })
      expect(spied.bulks).toEqual([['asset_a', 'asset_b']])
    })

    /**
     * Video, 3D and audio examples cannot be shown directly — the API renders a still for each
     * and puts it in `thumbnail`. Reading `url` alone leaves those workspaces without a card.
     */
    it('uses the rendered still when the example is not an image', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog })

      expect(await registry.previews(['asset_video'])).toEqual({
        asset_video: 'https://cdn/asset_video-still',
      })
    })

    it('drops an example that is neither a picture nor has a still', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog })

      expect(await registry.previews(['asset_text', 'asset_a'])).toEqual({
        asset_a: 'https://cdn/asset_a',
      })
    })

    /**
     * The URLs the API signs expire. Holding them for the life of the process leaves every
     * card already seen on a dead link, with no request ever made to refresh it.
     */
    it('asks again once a resolved picture has gone stale', async () => {
      let clock = 0
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({
        catalog: spied.catalog,
        ttlMs: 1000,
        now: () => clock,
      })

      await registry.previews(['asset_a'])
      clock = 999
      await registry.previews(['asset_a'])
      expect(spied.bulks).toHaveLength(1)

      clock = 1001
      await registry.previews(['asset_a'])
      expect(spied.bulks).toHaveLength(2)
    })

    // Asking again on every scroll would cost a request per screen, forever.
    it('remembers which assets have no picture and stops asking', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog })

      await registry.previews(['asset_missing'])
      await registry.previews(['asset_missing'])

      expect(spied.bulks).toHaveLength(1)
    })

    it('asks only for the assets it has not resolved yet', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog })

      await registry.previews(['asset_a'])
      await registry.previews(['asset_a', 'asset_b'])

      expect(spied.bulks).toEqual([['asset_a'], ['asset_b']])
    })
  })

  describe('describe', () => {
    it('translates a model’s inputs into descriptors', async () => {
      const registry = registryOf({ catalog: publicCatalog([FLUX]) })
      const descriptor = await registry.describe('model_flux')

      expect(descriptor.name).toBe('Flux')
      expect(descriptor.fields).toEqual([
        { key: 'prompt', kind: 'longText', label: 'Prompt', required: true, promptSpark: true },
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
      const registry = registryOf({ catalog: publicCatalog([VEO]) })
      await expect(registry.describe('model_veo')).resolves.toMatchObject({ fields: [] })
    })

    it('describes each model once', async () => {
      const catalog = vi.fn(publicCatalog([FLUX]))
      const registry = registryOf({ catalog })

      await registry.describe('model_flux')
      await registry.describe('model_flux')
      expect(catalog).toHaveBeenCalledOnce()
    })
  })

  describe('inputsOf', () => {
    /**
     * The API's own type, untranslated — `kind` is the studio's reading of it and is all a form
     * needs, while Scenario's workflow converter matches an edge to an input by this very field.
     */
    it('answers the inputs as the API spells them, not as a form reads them', async () => {
      const registry = registryOf({ catalog: publicCatalog([FLUX]) })

      await expect(registry.inputsOf('model_flux')).resolves.toEqual(FLUX.inputs)
    })

    it('answers no input for a model that declares none, rather than failing', async () => {
      const registry = registryOf({ catalog: publicCatalog([VEO]) })

      await expect(registry.inputsOf('model_veo')).resolves.toEqual([])
    })

    /**
     * One fetch for both readings. Two caches would let the form and the compiler disagree about
     * the same model, and would spend a round trip to do it.
     */
    it('shares its fetch with describe', async () => {
      const catalog = vi.fn(publicCatalog([FLUX]))
      const registry = registryOf({ catalog })

      await registry.describe('model_flux')
      await registry.inputsOf('model_flux')

      expect(catalog).toHaveBeenCalledOnce()
    })
  })
})
