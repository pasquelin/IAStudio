import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { useAssets } from './assets'
import { canvasOf, useCanvases } from './canvases'
import { installDocument } from './document-fixtures'
import { useDocuments } from './documents'
import { claimOnSubmit } from './generationClaims'
import { catalogueHolds, flush } from './generation-fixtures'
import { connectImageGeneration } from './imageGeneration'
import { job } from './job-fixtures'
import { useJobs } from './jobs'
import { connectSkyboxGeneration } from './skyboxGeneration'
import { skyboxOf, useSkyboxes } from './skyboxes'

const picture: Asset = {
  id: 'asset-1',
  name: 'dusk',
  type: 'image',
  location: 'local',
  jobId: 'job-1',
  tags: [],
  createdAt: '2026-08-08T10:00:00.000Z',
}

const done: Job = job({ id: 'job-1', label: 'Scenario Flux.1', status: 'succeeded' })

beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
  useJobs.setState({ jobs: [] })
  useAssets.setState({ items: [] })
  // Through the shared fixture, which answers the catalogue where the landing actually asks:
  // spelling it here by hand is what left this suite behind when that seam changed.
  catalogueHolds([picture])
})

/**
 * One entry point, and only the space whose tab is in front finds a target. The generator serves
 * every workspace, so it cannot be the one that knows which of them is listening.
 */
describe('claiming a generation for whichever space is in front', () => {
  it('lands it on the canvas when an image tab is the one open', async () => {
    const stop = connectImageGeneration()
    installDocument('doc-1', 'image')

    claimOnSubmit()(done)
    useJobs.setState({ jobs: [done] })
    await flush()

    expect(canvasOf(useCanvases.getState(), 'doc-1').layers).toHaveLength(2)
    stop()
  })

  it('lands it in the sky when a skybox tab is the one open', async () => {
    const stop = connectSkyboxGeneration()
    installDocument('doc-1', 'skyboxes')

    claimOnSubmit()(done)
    useJobs.setState({ jobs: [done] })
    await flush()

    expect(skyboxOf(useSkyboxes.getState(), 'doc-1').source?.assetId).toBe('asset-1')
    stop()
  })

  it('claims nothing when the job never came back', () => {
    installDocument('doc-1', 'image')

    expect(() => claimOnSubmit()(null)).not.toThrow()
  })
})
