import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job, JobStatus } from '@shared/domain/job'
import { useAssets } from './assets'
import { installDocument } from './document-fixtures'
import { useDocuments } from './documents'
import { job as jobOf } from './job-fixtures'
import { useJobs } from './jobs'
import { claimSkyboxOnSubmit, connectSkyboxGeneration } from './skybox-generation'
import { skyboxOf, useSkyboxes } from './skyboxes'

const panorama: Asset = {
  id: 'asset-dusk',
  name: 'dusk',
  type: 'skybox',
  location: 'local',
  jobId: 'job-1',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
}

/** The shared fixture, told what this suite asserts on: the sky model, and the id its asset names. */
const job = (overrides: Partial<Job> = {}): Job =>
  jobOf({ id: 'job-1', targetId: 'model_sky', label: 'Scenario Skybox Flux.1', ...overrides })

/**
 * The catalogue as the main process would answer it once the ingest is done. `refresh` is what
 * the seam calls rather than waiting on the coalesced invalidation, so this is where the asset
 * appears — never before the job reports.
 */
function catalogueHolds(assets: readonly Asset[]): void {
  useAssets.setState({ refresh: async () => void useAssets.setState({ items: assets }) })
}

/**
 * Lets every pending microtask run. The seam reads the catalogue back before it writes, so
 * without draining them the assertion runs before the sky is hung — and a test that passes for
 * that reason would pass just as well against a seam that does nothing.
 */
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

/** Drives the job to a terminal state, the way a progress event from the main process does. */
async function finish(status: JobStatus, overrides: Partial<Job> = {}): Promise<void> {
  useJobs.setState({ jobs: [job({ status, ...overrides })] })
  await flush()
}

/** The two ways a job ends with nothing to hang. */
const LOST: readonly JobStatus[] = ['failed', 'cancelled']

const sourceOf = (documentId: string): { assetId: string } | null =>
  skyboxOf(useSkyboxes.getState(), documentId).source

/** Submits from whatever tab is in front, the way the generator does — capture, then settle. */
function submitFrom(jobId: string): void {
  claimSkyboxOnSubmit()(job({ id: jobId }))
}

/** Two skies open at once, `doc-1` in front — `installDocument` only ever installs one. */
function openBoth(): void {
  useDocuments.setState(state => ({
    documents: {
      ...state.documents,
      'doc-2': { id: 'doc-2', kind: 'skybox', title: 'Other', workspace: 'skyboxes' },
    },
  }))
}

describe('landing a generation in the sky that asked for it', () => {
  let disconnect: () => void = () => {}

  beforeEach(() => {
    useSkyboxes.setState({ states: {}, histories: {} })
    useAssets.setState({ items: [] })
    useJobs.setState({ jobs: [], bodies: {} })
    catalogueHolds([panorama])
    installDocument('doc-1', 'skyboxes')
    disconnect = connectSkyboxGeneration()
  })

  // Disconnecting drops the claims with the subscription, which is also the reset between cases.
  afterEach(() => {
    disconnect()
  })

  it('hangs what the finished job produced', async () => {
    submitFrom('job-1')
    await finish('succeeded')

    expect(sourceOf('doc-1')).toEqual({ assetId: 'asset-dusk' })
  })

  it('records what produced it, from the body the renderer submitted', async () => {
    useJobs.setState({ bodies: { 'job-1': { prompt: 'a dusk over water', seed: 42 } } })
    submitFrom('job-1')
    await finish('succeeded')

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').generation).toEqual({
      modelId: 'model_sky',
      modelLabel: 'Scenario Skybox Flux.1',
      prompt: 'a dusk over water',
      seed: 42,
    })
  })

  it('leaves the sky alone until the job actually finishes', async () => {
    submitFrom('job-1')
    useJobs.setState({ jobs: [job({ status: 'running', progress: 0.9 })] })
    await flush()

    expect(sourceOf('doc-1')).toBeNull()
  })

  it.each(LOST)('hangs nothing when the job %s', async status => {
    submitFrom('job-1')
    await finish(status)

    expect(sourceOf('doc-1')).toBeNull()
  })

  // The generator serves every workspace: a job launched from Image has nowhere to land, and
  // must not follow the user into a sky opened while it ran.
  it('claims nothing when the document submitted from is not a sky', async () => {
    installDocument('doc-2', 'image')
    submitFrom('job-1')

    installDocument('doc-1', 'skyboxes')
    await finish('succeeded')

    expect(sourceOf('doc-1')).toBeNull()
  })

  /**
   * The two halves are tested apart on purpose. `POST /generate` is a round trip, and the user
   * who switches tabs during it started the work in the previous one: reading the target when
   * the job id arrives would land the picture wherever they went.
   */
  it('writes into the sky it was launched from, not the one in front when the id arrives', async () => {
    const claim = claimSkyboxOnSubmit()

    openBoth()
    useDocuments.setState({ activeId: 'doc-2' })
    claim(job({ id: 'job-1' }))
    await finish('succeeded')

    expect(sourceOf('doc-1')).toEqual({ assetId: 'asset-dusk' })
    expect(sourceOf('doc-2')).toBeNull()
  })

  it('drops it silently when the tab was closed while the job ran', async () => {
    submitFrom('job-1')
    useDocuments.setState({ documents: {}, activeId: null })
    await finish('succeeded')

    expect(useSkyboxes.getState().states['doc-1']).toBeUndefined()
  })

  // A generation answers a batch and a sky is one sky. The other half of `takes` is the canvas,
  // which gives each of the same batch a layer — see `image-generation`.
  it('hangs the first of a batch and leaves the rest on the shelf', async () => {
    catalogueHolds([panorama, { ...panorama, id: 'asset-dawn', name: 'dawn' }])
    submitFrom('job-1')
    await finish('succeeded')

    expect(sourceOf('doc-1')).toEqual({ assetId: 'asset-dusk' })
  })

  it('ignores an outcome that decodes as no picture', async () => {
    catalogueHolds([{ ...panorama, type: 'mesh' }])
    submitFrom('job-1')
    await finish('succeeded')

    expect(sourceOf('doc-1')).toBeNull()
  })

  // A settled claim is gone: a later event on the same job — the list refreshing, another
  // progress arriving — must not hang the picture a second time over an edited sky.
  it('lands once, not on every event that follows', async () => {
    submitFrom('job-1')
    await finish('succeeded')

    useSkyboxes.getState().runCommand('doc-1', {
      id: 'clear',
      apply: content => ({ ...content, source: null }),
      revert: content => content,
    })
    await finish('succeeded')

    expect(sourceOf('doc-1')).toBeNull()
  })
})
