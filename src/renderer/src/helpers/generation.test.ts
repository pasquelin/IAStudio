import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
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

const job = (overrides: Partial<Job> = {}): Job => ({
  id: 'job-1',
  modelId: 'eleven-music-v2',
  label: 'ElevenLabs Music v2',
  status: 'succeeded',
  progress: 1,
  createdAt: '2026-08-07T10:00:00.000Z',
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

    expect(generationOf(recorded, [job()], { 'job-1': { prompt: 'from the job' } })?.prompt).toBe(
      'from the catalogue',
    )
  })

  it('reconstitutes it from the job this session submitted', () => {
    const bodies = { 'job-1': { prompt: 'a soft pad', seed: 42 } }

    expect(generationOf(asset({ jobId: 'job-1' }), [job()], bodies)).toMatchObject({
      modelId: 'eleven-music-v2',
      modelLabel: 'ElevenLabs Music v2',
      prompt: 'a soft pad',
      seed: 42,
    })
  })

  it('recovers a seed a form control handed back as text', () => {
    const bodies = { 'job-1': { prompt: 'x', seed: '1234' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [job()], bodies)?.seed).toBe(1234)
  })

  it('leaves the seed out when the model never asked for one', () => {
    const bodies = { 'job-1': { prompt: 'x' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [job()], bodies)?.seed).toBeUndefined()
  })

  it('finds the prompt whichever of the usual keys the model named it', () => {
    const bodies = { 'job-1': { text: 'under another name' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [job()], bodies)?.prompt).toBe(
      'under another name',
    )
  })

  it('answers nothing for an imported file, which no job produced', () => {
    expect(generationOf(asset(), [], {})).toBeNull()
  })

  it('answers nothing for a job this session never submitted, such as after a reload', () => {
    expect(generationOf(asset({ jobId: 'job-1' }), [job()], {})).toBeNull()
  })

  it('keeps the whole body, so regenerating carries every parameter and not just the prompt', () => {
    const bodies = { 'job-1': { prompt: 'x', guidance: 7, negative: 'flou' } }
    expect(generationOf(asset({ jobId: 'job-1' }), [job()], bodies)?.params).toEqual(
      bodies['job-1'],
    )
  })
})
