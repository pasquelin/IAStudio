import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { job } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import { useTaskChoices } from './useTaskChoices'

const DRAFT: FieldDescriptor = {
  key: 'draft_model_task_id',
  label: 'Brouillon',
  kind: 'task',
  required: true,
}

const done = (overrides: Parameters<typeof job>[0]) =>
  job({
    status: 'succeeded',
    finishedAt: '2026-08-31T09:00:00.000Z',
    assetIds: ['asset-1'],
    ...overrides,
  })

beforeEach(() => {
  useJobs.setState({ jobs: [] })
})

/**
 * 🛑 A task id belongs to the service that issued it. The catalogue cannot hold this list — only
 * the window knows what has run — and a runner offered another cloud's id would be refused after
 * the round trip, having already spent it.
 */
describe('useTaskChoices', () => {
  it('offers the finished runs of the same service, named and dated', () => {
    useJobs.setState({
      jobs: [done({ id: 'j1', targetId: 'tripo:generation/text-to-model:v3.1', remoteId: '9a1c' })],
    })

    const { result } = renderHook(() => useTaskChoices([DRAFT], 'tripo:models/refine'))

    expect(result.current[0]?.options?.[0]?.value).toBe('9a1c')
    expect(result.current[0]?.options?.[0]?.label).toContain('Flux')
  })

  it('leaves out a run of another service, whose id means nothing here', () => {
    useJobs.setState({ jobs: [done({ id: 'j2', targetId: 'model_flux', remoteId: 'scenario-1' })] })

    const { result } = renderHook(() => useTaskChoices([DRAFT], 'tripo:models/refine'))

    expect(result.current[0]?.options).toEqual([])
  })

  // A free check writes no file, and refining what it answered is refused after the round trip.
  it('leaves out a run that produced nothing to work on', () => {
    useJobs.setState({
      jobs: [done({ id: 'j5', targetId: 'tripo:a:b', remoteId: '9a1c', assetIds: [] })],
    })

    const { result } = renderHook(() => useTaskChoices([DRAFT], 'tripo:models/refine'))

    expect(result.current[0]?.options).toEqual([])
  })

  // Nothing of it exists yet — the id is minted at submit, and the run may still fail.
  it('leaves out a run that has not finished, and one the service never named', () => {
    useJobs.setState({
      jobs: [
        job({ id: 'j3', targetId: 'tripo:a:b', remoteId: '9a1c', status: 'running' }),
        done({ id: 'j4', targetId: 'tripo:a:b' }),
      ],
    })

    const { result } = renderHook(() => useTaskChoices([DRAFT], 'tripo:models/refine'))

    expect(result.current[0]?.options).toEqual([])
  })

  it('hands a form with no task field back as it stands', () => {
    const prompt: FieldDescriptor = { key: 'prompt', label: 'Prompt', kind: 'text', required: true }

    const { result } = renderHook(() => useTaskChoices([prompt], 'model_flux'))

    expect(result.current).toEqual([prompt])
  })
})
