import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job, JobStatus } from '@shared/domain/job'
import { useAssets } from './assets'
import { useDocuments } from './documents'
import { useJobs } from './jobs'
import { claimGeneration, connectSkyboxGeneration, forgetGenerations } from './skybox-generation'
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

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  modelId: 'model_sky',
  label: 'Scenario Skybox Flux.1',
  status: 'running',
  progress: 0.5,
  createdAt: '2026-08-07T10:00:00.000Z',
  assetIds: [],
  ...overrides,
})

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

describe('landing a generation in the sky that asked for it', () => {
  let disconnect: () => void = () => {}

  beforeEach(() => {
    forgetGenerations()
    useSkyboxes.setState({ states: {}, histories: {} })
    useAssets.setState({ items: [] })
    useJobs.setState({ jobs: [], bodies: {} })
    catalogueHolds([panorama])
    useDocuments.setState({
      documents: { 'doc-1': { id: 'doc-1', kind: 'skybox', title: 'Sky', workspace: 'skyboxes' } },
      activeId: 'doc-1',
    })
    disconnect = connectSkyboxGeneration()
  })

  afterEach(() => {
    disconnect()
  })

  it('hangs what the finished job produced', async () => {
    claimGeneration('job-1')
    await finish('succeeded')

    expect(sourceOf('doc-1')).toEqual({ assetId: 'asset-dusk' })
  })

  it('records what produced it, from the body the renderer submitted', async () => {
    useJobs.setState({ bodies: { 'job-1': { prompt: 'a dusk over water', seed: 42 } } })
    claimGeneration('job-1')
    await finish('succeeded')

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').generation).toEqual({
      modelId: 'model_sky',
      modelLabel: 'Scenario Skybox Flux.1',
      prompt: 'a dusk over water',
      seed: 42,
    })
  })

  it('leaves the sky alone until the job actually finishes', async () => {
    claimGeneration('job-1')
    useJobs.setState({ jobs: [job({ status: 'running', progress: 0.9 })] })
    await flush()

    expect(sourceOf('doc-1')).toBeNull()
  })

  it('hangs nothing when the job failed or was cancelled', async () => {
    for (const status of LOST) {
      forgetGenerations()
      useSkyboxes.setState({ states: {}, histories: {} })
      claimGeneration('job-1')
      await finish(status)

      expect(sourceOf('doc-1')).toBeNull()
    }
  })

  // The generator serves every workspace: a job launched from Image has nowhere to land, and
  // must not follow the user into a sky opened while it ran.
  it('claims nothing when the document in front is not a sky', async () => {
    useDocuments.setState({
      documents: { 'doc-2': { id: 'doc-2', kind: 'image', title: 'Img', workspace: 'image' } },
      activeId: 'doc-2',
    })
    claimGeneration('job-1')

    useDocuments.setState({
      documents: { 'doc-1': { id: 'doc-1', kind: 'skybox', title: 'Sky', workspace: 'skyboxes' } },
      activeId: 'doc-1',
    })
    await finish('succeeded')

    expect(sourceOf('doc-1')).toBeNull()
  })

  it('writes into the sky it was launched from, not the one in front now', async () => {
    claimGeneration('job-1')
    useDocuments.setState({
      documents: {
        'doc-1': { id: 'doc-1', kind: 'skybox', title: 'Sky', workspace: 'skyboxes' },
        'doc-2': { id: 'doc-2', kind: 'skybox', title: 'Other', workspace: 'skyboxes' },
      },
      activeId: 'doc-2',
    })
    await finish('succeeded')

    expect(sourceOf('doc-1')).toEqual({ assetId: 'asset-dusk' })
    expect(sourceOf('doc-2')).toBeNull()
  })

  it('drops it silently when the tab was closed while the job ran', async () => {
    claimGeneration('job-1')
    useDocuments.setState({ documents: {}, activeId: null })

    await expect(finish('succeeded')).resolves.toBeUndefined()
    expect(useSkyboxes.getState().states['doc-1']).toBeUndefined()
  })

  it('ignores an outcome that decodes as no picture', async () => {
    catalogueHolds([{ ...panorama, type: 'mesh' }])
    claimGeneration('job-1')
    await finish('succeeded')

    expect(sourceOf('doc-1')).toBeNull()
  })

  // A settled claim is gone: a later event on the same job — the list refreshing, another
  // progress arriving — must not hang the picture a second time over an edited sky.
  it('lands once, not on every event that follows', async () => {
    claimGeneration('job-1')
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
