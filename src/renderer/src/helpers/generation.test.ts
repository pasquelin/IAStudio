import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { job as jobFixture } from '@/stores/job-fixtures'
import { generationOf } from './generation'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

/** The generation this suite traces back, already finished. The SHAPE comes from the factory. */
const generated = (overrides: Partial<Job> = {}): Job =>
  jobFixture({
    id: 'job-1',
    targetId: 'eleven-music-v2',
    label: 'ElevenLabs Music v2',
    status: 'succeeded',
    assetIds: ['asset-1'],
    ...overrides,
  })

describe('where an asset came from', () => {
  it('prefers what the catalogue recorded', () => {
    const recorded = asset({
      jobId: 'job-1',
      generation: {
        modelId: 'stored',
        modelLabel: 'Stored',
        prompt: 'from the catalogue',
        params: {},
      },
    })

    expect(
      generationOf(recorded, [generated()], { 'job-1': { prompt: 'from the job' } })?.prompt,
    ).toBe('from the catalogue')
  })

  it('reconstitutes it from the job this session submitted', () => {
    const bodies = { 'job-1': { prompt: 'a soft pad', seed: 42 } }

    expect(generationOf(asset({ jobId: 'job-1' }), [generated()], bodies)).toMatchObject({
      modelId: 'eleven-music-v2',
      modelLabel: 'ElevenLabs Music v2',
      prompt: 'a soft pad',
      seed: 42,
    })
  })

  it('recovers a seed a form control handed back as text', () => {
    const bodies = { 'job-1': { prompt: 'x', seed: '1234' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [generated()], bodies)?.seed).toBe(1234)
  })

  it('leaves the seed out when the model never asked for one', () => {
    const bodies = { 'job-1': { prompt: 'x' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [generated()], bodies)?.seed).toBeUndefined()
  })

  it('finds the prompt whichever of the usual keys the model named it', () => {
    const bodies = { 'job-1': { text: 'under another name' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [generated()], bodies)?.prompt).toBe(
      'under another name',
    )
  })

  it('answers nothing for an imported file, which no job produced', () => {
    expect(generationOf(asset(), [], {})).toBeNull()
  })

  it('answers nothing for a job this session never submitted, such as after a reload', () => {
    expect(generationOf(asset({ jobId: 'job-1' }), [generated()], {})).toBeNull()
  })

  /**
   * A workflow's id is not a model's. Answered as a generation, "regenerate with these
   * parameters" would open the generator on a model the catalogue has never heard of.
   */
  it('answers nothing for what an App produced', () => {
    const workflowJob = generated({ kind: 'workflow', targetId: 'workflow_1' })
    const bodies = { 'job-1': { prompt: 'a soft pad' } }

    expect(generationOf(asset({ jobId: 'job-1' }), [workflowJob], bodies)).toBeNull()
  })

  it('keeps the whole body, so regenerating carries every parameter and not just the prompt', () => {
    const bodies = { 'job-1': { prompt: 'x', guidance: 7, negative: 'flou' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [generated()], bodies)?.params).toEqual(
      bodies['job-1'],
    )
  })
})
