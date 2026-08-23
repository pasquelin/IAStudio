import { describe, expect, it, vi } from 'vitest'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import {
  LOCAL_RUNTIME,
  PROVIDER_MAINTAINER,
  SKYBOX_TAG,
  SYSTEM_TAG_PREFIX,
} from '@shared/domain/model'
import { localModel } from '@shared/domain/localModel-fixtures'
import { createCredentialsWatch } from './credentialsWatch'
import {
  createModelRegistry,
  type ListRequest,
  type ModelCatalog,
  type ModelRegistry,
  type RegistryOptions,
  type RemoteModel,
  type SearchRequest,
} from './modelRegistry'

/**
 * The account switch is its own subject, below: everything else is built deaf to it. The local
 * catalogue is empty by default — the cases that care about it hand one in.
 */
const registryOf = (
  options: Omit<RegistryOptions, 'watch' | 'localModels' | 'translate' | 'isInstalled'> &
    Partial<Pick<RegistryOptions, 'localModels' | 'translate' | 'isInstalled'>>,
): ModelRegistry =>
  createModelRegistry({
    localModels: () => [],
    // Present by default: a case about the panel's shape should not have to say so, and the two
    // that care about the download hand in their own answer.
    isInstalled: () => true,
    // What a bundle would answer, without one: the labels of a local form are keys until a
    // language names them, and nothing here is a screen.
    translate: key => key,
    ...options,
    watch: () => () => {},
  })

/** What the catalogue answers for a model Scenario publishes — see `isOfficial`, which needs both. */
const PROVIDER_OWNED = {
  privacy: 'public',
  complianceMetadata: { maintainer: PROVIDER_MAINTAINER },
}

const FLUX: RemoteModel = {
  ...PROVIDER_OWNED,
  id: 'model_flux',
  name: 'Flux',
  capabilities: ['txt2img', 'img2img'],
  source: 'scenario',
  tags: ['Image'],
  shortDescription: 'A fast image model',
  thumbnail: { url: 'https://cdn.example/flux.png' },
  createdAt: '2026-01-02T00:00:00.000Z',
  inputs: [
    { name: 'prompt', type: 'string', prompt: true, required: { always: true } },
    { name: 'numInferenceSteps', type: 'number', min: 1, max: 50, default: 28 },
  ],
}

const VEO: RemoteModel = { id: 'model_veo', name: 'Veo', capabilities: ['txt2video'] }

/**
 * Shaped after `model_scenario-skybox-flux`: a panorama model answers the image capabilities,
 * and it is maintained by Scenario while carrying no `sc:scenario` tag — see
 * `PROVIDER_MAINTAINER` for what that combination cost.
 */
const SKY: RemoteModel = {
  ...PROVIDER_OWNED,
  id: 'model_sky',
  name: 'Scenario Skybox Flux.1',
  capabilities: ['txt2img', 'img2img'],
  tags: [SKYBOX_TAG, 'panorama'],
}

/** Shaped after `model_ideogram-remove-background`: a cutout model answers `img2img` too. */
const CUTOUT: RemoteModel = {
  ...PROVIDER_OWNED,
  id: 'model_cutout',
  name: 'Ideogram Remove Background',
  capabilities: ['img2img'],
  tags: ['remove-background'],
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
      // Narrowed server-side, as the real endpoint does: a page fetched under a tag holds fewer
      // models than the same page without one, which is what makes it a page of its own rather
      // than a slice of the catalogue. And it answers NOTHING for Scenario's own namespace —
      // measured, `tags=sc:skybox` returns no model while the unfiltered listing serves all
      // three. A fake that honoured those would stay green on the defect that emptied the
      // skybox workspace.
      const held = request.tag?.startsWith(SYSTEM_TAG_PREFIX)
        ? []
        : (catalogue[request.privacy] ?? []).filter(
            model => !request.tag || (model.tags ?? []).includes(request.tag),
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
        runsOn: SCENARIO_CLOUD,
        source: 'scenario',
        origin: 'official',
        featured: false,
        capabilities: ['txt2img', 'img2img'],
        tags: ['Image'],
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
        runsOn: SCENARIO_CLOUD,
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

  /**
   * MEASURED, and the reason the grade is remembered at all: `GET /models` grades every model
   * with a number, while `POST /search/models` answers `null` on every hit — the search index
   * does not carry the field. Written straight through, that `null` landed in a `number` field
   * and the same model went from greyed out in the listing to freely pickable the moment the
   * user typed its name.
   */
  it('grades a search hit from what the listing already said', async () => {
    // The two endpoints answer the SAME model differently — that is the whole bug.
    const catalog = (): ModelCatalog => ({
      list: () =>
        Promise.resolve({
          models: [{ id: 'model_seedance', accessRestrictions: 50 }],
          token: null,
        }),
      search: () =>
        Promise.resolve({
          models: [{ id: 'model_seedance', name: 'Seedance', accessRestrictions: null }],
          token: null,
        }),
      retrieve: () => Promise.reject(new Error('not asked')),
      assetUrls: () => Promise.resolve([]),
    })
    const registry = registryOf({ catalog })

    // Listed first, as the panel does before anyone types.
    await registry.search({})
    const { items } = await registry.search({ search: 'seedance' })

    expect(items[0]?.requiredPlanLevel).toBe(50)
  })

  // Ungraded is the permissive answer; a grade invented at 0 would refuse nothing but would
  // also claim to know, and the free tier IS 0.
  it('leaves a search hit it has never listed ungraded', async () => {
    const catalog = (): ModelCatalog => ({
      list: () => Promise.resolve({ models: [], token: null }),
      search: () =>
        Promise.resolve({
          models: [{ id: 'model_unseen', name: 'Unseen', accessRestrictions: null }],
          token: null,
        }),
      retrieve: () => Promise.reject(new Error('not asked')),
      assetUrls: () => Promise.resolve([]),
    })
    const registry = registryOf({ catalog })

    const { items } = await registry.search({ search: 'unseen' })

    expect(items[0]?.requiredPlanLevel).toBeUndefined()
  })

  /** The tag `PROVIDER_MAINTAINER` replaces missed `SKY`, and with it the whole Skyboxes space. */
  it('reads authorship from the maintainer, which the official tag only half covers', async () => {
    const registry = registryOf({ catalog: publicCatalog([FLUX, SKY, VEO]) })

    const officials = await registry.search({ origin: 'official' })
    expect(officials.items.map(item => item.id)).toEqual(['model_flux', 'model_sky'])

    expect((await registry.search({ origin: 'community' })).items).toEqual([
      expect.objectContaining({ id: 'model_veo', origin: 'community' }),
    ])
  })

  /**
   * MEASURED 2026-08-15: the one model this account has trained answers `maintainer: Scenario`
   * like the catalogue does, so that field alone filed the user's own models as official — and
   * "Community" then hid the only models nobody else can see.
   */
  it('never calls a private model official, whoever maintains it', async () => {
    const mine: RemoteModel = { ...PROVIDER_OWNED, privacy: 'private', id: 'model_mine' }
    const registry = registryOf({
      catalog: spiedCatalog({ private: [mine], public: [FLUX] }).catalog,
    })

    expect((await registry.search({ origin: 'community' })).items).toEqual([
      expect.objectContaining({ id: 'model_mine', origin: 'community' }),
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
   * MEASURED 2026-08-14: `GET /models?tags=sc:skybox` answers zero models, while the three that
   * carry the tag come out of the very same listing when it is asked for none. Narrowing by it
   * left the skybox workspace with nothing to choose from, so the walk goes wide instead and
   * `matches` keeps the family from the records. A chosen tag still wins over the family.
   */
  it('keeps the skybox family without asking for a tag the API does not index', async () => {
    const spied = spiedCatalog({ public: [SKY, FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    const skyboxes = await registry.search({ family: 'skybox' })
    expect(skyboxes.items.map(item => item.id)).toEqual(['model_sky'])
    expect(spied.lists.some(request => request.tag?.startsWith(SYSTEM_TAG_PREFIX))).toBe(false)

    await registry.search({ family: 'skybox', tags: ['panorama'] })
    expect(spied.lists.at(-1)?.tag).toBe('panorama')
  })

  /**
   * The three edit families are as sparse as the skyboxes and are found the same way. Measured:
   * nine models carry `remove-background`, thirteen `image-upscale`, four `vectorize`.
   */
  it('asks the API for the tag of every family the endpoint indexes', async () => {
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

  // A tagged listing holds fewer models than the plain one, so its page is a page of its own.
  // Without the tag in the cache key, those nine cutouts answered the Image listing that came
  // next. The families resolving to no tag share one page instead, which is the point of keying
  // by the tag rather than by the family.
  it('does not serve a tagged page back to another family', async () => {
    const spied = spiedCatalog({ public: [CUTOUT, FLUX] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({ family: 'background-removal' })
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

  /**
   * `tags=sc:scenario` answers zero models too, so authorship is read off the records and the
   * origin no longer changes what is asked for. The pages are therefore the same pages, and
   * ticking "Official" used to redownload what the listing had in hand a second earlier.
   */
  it('reuses the pages already walked when only the origin changes', async () => {
    const spied = spiedCatalog({ public: [FLUX, VEO] })
    const registry = registryOf({ catalog: spied.catalog })

    await registry.search({})
    const walked = spied.lists.length
    const officials = await registry.search({ origin: 'official' })

    expect(officials.items.map(item => item.id)).toEqual(['model_flux'])
    expect(spied.lists).toHaveLength(walked)
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
    const registry = createModelRegistry({
      catalog: spied.catalog,
      watch: watch.watch,
      localModels: () => [],
      isInstalled: () => true,
      translate: key => key,
    })

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

    /**
     * 🛑 Measured 2026-08-22: a manifest naming no family made `localSummaryOf` answer null, the
     * lookup fell through to the API, and a LOCAL id was sent to Scenario — `404 Model ssd-1b not
     * found`, journalled as a generation failure. A model on this machine never reaches the API,
     * whatever its manifest is missing: what is missing is a defect of ours, answered from here.
     */
    it('never asks the API about a model this machine holds, however thin its manifest', async () => {
      const thin = localModel({ id: 'local_thin', name: 'Thin', modality: 'image' })
      // `retrieve` rejects: reaching the API at all is what this test refuses, and a rejection
      // says so where a silent answer would let the call through unnoticed.
      const catalog = (): ModelCatalog => ({
        list: () => Promise.resolve({ models: [], token: null }),
        search: () => Promise.resolve({ models: [], token: null }),
        retrieve: () => Promise.reject(new Error('not asked')),
        assetUrls: () => Promise.resolve([]),
      })
      const registry = registryOf({ catalog, localModels: () => [thin] })

      const descriptor = await registry.describe('local_thin')

      expect(descriptor.name).toBe('Thin')
      expect(descriptor.fields.map(field => field.key)).toContain('prompt')
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

  /**
   * The two catalogues merge here and nowhere else — ADR-21 as amended. What is checked is that a
   * model on this machine reaches the SAME panel, through the same filters, with the same shape.
   */
  describe('the local catalogue', () => {
    const LOCAL = localModel({
      id: 'local_diffusion',
      name: 'A model of this machine',
      family: 'image',
      capabilities: ['txt2img'],
      modality: 'image',
    })

    it('offers a local model beside the cloud ones, saying where each runs', async () => {
      const registry = registryOf({ catalog: publicCatalog([FLUX]), localModels: () => [LOCAL] })

      const page = await registry.search({})

      expect(page.items.map(one => [one.id, one.runsOn])).toEqual([
        ['local_diffusion', LOCAL_RUNTIME],
        ['model_flux', SCENARIO_CLOUD],
      ])
    })

    it('shows a local model added after the listing was cached', async () => {
      let locals: ReturnType<typeof localModel>[] = []
      const registry = registryOf({
        catalog: publicCatalog([FLUX]),
        localModels: () => locals,
        ttlMs: 60_000,
      })

      await registry.search({})
      locals = [LOCAL]
      const page = await registry.search({})

      expect(page.items.map(one => one.id)).toContain('local_diffusion')
    })

    /**
     * The assistant and the recognition model answer a ROLE, and the manager screen is where those
     * are chosen. A model with no family in a space's panel would be a row nothing can generate.
     */
    it('keeps a model that serves no space out of the panel', async () => {
      const registry = registryOf({
        catalog: publicCatalog([]),
        localModels: () => [localModel({ id: 'qwen' })],
      })

      expect((await registry.search({})).items).toEqual([])
    })

    it('marks a listed card with nothing to fetch as not downloadable', async () => {
      const listed = localModel({
        id: 'panfusion',
        family: 'skybox',
        capabilities: ['txt2skybox'],
        files: [],
      })
      const registry = registryOf({
        catalog: publicCatalog([]),
        localModels: () => [listed],
        isInstalled: () => false,
      })

      const [item] = (await registry.search({ family: 'skybox' })).items

      expect(item?.installed).toBe(false)
      expect(item?.downloadable).toBe(false)
    })

    it('narrows a local model by family and by capability like any other', async () => {
      const registry = registryOf({ catalog: publicCatalog([]), localModels: () => [LOCAL] })

      expect((await registry.search({ family: 'image' })).items).toHaveLength(1)
      expect((await registry.search({ family: 'video' })).items).toEqual([])
      expect((await registry.search({ family: 'texture' })).items).toEqual([])
      expect((await registry.search({ capabilities: ['img2img'] })).items).toEqual([])
    })

    /**
     * A painter is filed under image and still draws textures. Asking the texture space used
     * to answer nothing, and the panel told the person to type a key for models that need none.
     */
    it("lists a model in the space it serves, wearing that space's family", async () => {
      const painter = localModel({
        id: 'ssd-1b',
        family: 'image',
        capabilities: ['txt2img', 'img2img'],
        serves: ['texture/txt2img_texture', 'texture/img2img_texture'],
        modality: 'image',
      })
      const registry = registryOf({ catalog: publicCatalog([]), localModels: () => [painter] })

      const textures = await registry.search({ family: 'texture' })
      expect(textures.items).toEqual([
        expect.objectContaining({
          id: 'ssd-1b',
          family: 'texture',
          capabilities: ['txt2img_texture', 'img2img_texture'],
        }),
      ])
      expect((await registry.search({ family: 'image' })).items).toEqual([
        expect.objectContaining({
          id: 'ssd-1b',
          family: 'image',
          capabilities: ['txt2img', 'img2img'],
        }),
      ])
      expect((await registry.search({ family: 'video' })).items).toEqual([])
    })

    /**
     * 🛑 Asking for this machine must not walk the catalogue: the pages could only be discarded,
     * and each of them is a round trip — on a studio that may hold no account at all.
     */
    it('asks the API nothing when the person narrowed to this machine', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog, localModels: () => [LOCAL] })

      const page = await registry.search({ runsOn: LOCAL_RUNTIME })

      expect(page.items.map(one => one.id)).toEqual(['local_diffusion'])
      expect(spied.lists).toEqual([])
    })

    // A cursor means "further into the catalogue", and this machine's handful is not paginated:
    // repeating it on every page would list the same rows forever.
    it('rides on the first page alone', async () => {
      const registry = registryOf({
        catalog: publicCatalog(Array.from({ length: 60 }, (_, at) => ({ ...FLUX, id: `m_${at}` }))),
        localModels: () => [LOCAL],
      })

      const first = await registry.search({ limit: 24 })
      const second = await registry.search({ limit: 24, cursor: first.cursor ?? undefined })

      expect(first.items[0]?.id).toBe('local_diffusion')
      expect(second.items.map(one => one.id)).not.toContain('local_diffusion')
    })

    /**
     * Invariant 5 held from the other side: a model on this machine has no server to ask, so its
     * form comes from its MODALITY — and it is `<DynamicForm/>` that renders it, unchanged.
     */
    it('describes a local model from its modality, without a round trip', async () => {
      const spied = spiedCatalog({ public: [FLUX] })
      const registry = registryOf({ catalog: spied.catalog, localModels: () => [LOCAL] })

      const described = await registry.describe('local_diffusion')

      expect(described.fields.map(field => field.key)).toContain('steps')
      expect(described.runsOn).toBe(LOCAL_RUNTIME)
      expect(spied.lists).toEqual([])
    })

    // A card with nothing to draw is what the shipped pictures exist to prevent — and a model the
    // person supplied gets the generic one of its modality rather than a broken tile.
    it('always names a picture, shipped beside the catalogue', async () => {
      const registry = registryOf({ catalog: publicCatalog([]), localModels: () => [LOCAL] })

      expect((await registry.search({})).items[0]?.thumbnail).toContain('model/')
    })
  })
})
