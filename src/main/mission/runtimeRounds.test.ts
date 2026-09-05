import { describe, expect, it } from 'vitest'
import {
  missionTestBrain as brainWith,
  missionTestRuntime as runtimeWith,
} from './runtimeTestSupport'

describe('mission runtime rounds after the first', () => {
  it('tells the brain it is continuing once an action has run, whatever it answered', async () => {
    const { brain, requests } = brainWith([
      { say: '', calls: [{ action: 'project.create', input: {} }], cost: 0 },
      { say: 'Done.', calls: [], cost: 0 },
    ])

    await runtimeWith(brain).runtime.create('Create a project', {})

    expect(requests.map(request => request.continuing === true)).toEqual([false, true])
    expect(requests.every(request => request.mission === true)).toBe(true)
  })

  it('plans again rather than verifying after a read, which engages nothing', async () => {
    const { brain } = brainWith([
      { say: '', calls: [{ action: 'files.search', input: { query: 'boat' } }], cost: 0 },
      { say: 'Nothing to duplicate.', calls: [], cost: 0 },
    ])

    const mission = await runtimeWith(brain).runtime.create('Duplicate the boat', {})

    expect(mission.plan.steps.map(step => step.kind)).toEqual(['reason', 'action', 'reason'])
  })

  it('asks a verifying round to plan on rather than to confirm', async () => {
    const { brain, requests } = brainWith([
      { say: '', calls: [{ action: 'project.create', input: {} }], cost: 0 },
      { say: 'Done.', calls: [], cost: 0 },
    ])

    const mission = await runtimeWith(brain).runtime.create('Create a project', {})

    expect(mission.plan.steps.map(step => step.kind)).toEqual(['reason', 'action', 'verify'])
    expect(requests[1]?.utterance).toContain('plan the next calls if it is not')
  })

  it('fails the mission on an answer nothing could be read from', async () => {
    const { brain } = brainWith([{ say: '', calls: [], unreadable: true, cost: 0 }])

    const mission = await runtimeWith(brain).runtime.create('Create a project', {})

    expect(mission.state).toBe('failed')
    expect(mission.plan.steps[0]?.error).toBe('the model answered nothing readable')
  })
})
