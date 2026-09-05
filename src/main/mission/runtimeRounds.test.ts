import { describe, expect, it, vi } from 'vitest'
import type { AssistantBrain } from '@main/assistant/brainPort'
import type { MissionJournal } from './journal'
import { createStudioEventBus } from './eventBus'
import { createMissionManager } from './manager'
import { createMissionRuntime } from './runtime'
import { createMissionStore } from './store'
import {
  missionTestBrain as brainWith,
  missionTestClock as clock,
  missionTestContext as contextFor,
} from './runtimeTestSupport'

describe('mission runtime rounds after the first', () => {
  const runtimeWith = (brain: AssistantBrain) => {
    const time = clock()
    const journal: MissionJournal = { read: async () => [], append: vi.fn(), flush: vi.fn() }
    const manager = createMissionManager(createMissionStore(journal), createStudioEventBus(), time)
    return createMissionRuntime({
      manager,
      context: { build: async ({ mission }) => contextFor(mission) },
      brain,
      actions: { run: async () => ({ ok: true }), settle: vi.fn() },
      jobs: { list: () => [] },
      revisions: { read: async () => ({ current: [], unavailable: [] }) },
      clock: time,
    })
  }

  it('tells the brain it is continuing once a step has completed', async () => {
    const { brain, requests } = brainWith([
      { say: '', calls: [{ action: 'project.create', input: {} }], cost: 0 },
      { say: 'Done.', calls: [], cost: 0 },
    ])

    await runtimeWith(brain).create('Create a project', {})

    expect(requests.map(request => request.continuing === true)).toEqual([false, true])
  })

  it('fails the mission on an answer with neither a word, a question nor a call', async () => {
    const { brain } = brainWith([{ say: '', calls: [], cost: 0 }])

    const mission = await runtimeWith(brain).create('Create a project', {})

    expect(mission.state).toBe('failed')
    expect(mission.plan.steps[0]?.error).toBe('the model answered nothing readable')
  })
})
