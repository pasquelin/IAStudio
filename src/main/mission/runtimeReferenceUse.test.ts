import { expect, it, vi } from 'vitest'
import type { ActionOutcome, AssistantCall } from '@shared/domain/assistant'
import { createStudioEventBus } from './eventBus'
import type { MissionJournal } from './journal'
import { createMissionManager } from './manager'
import { createMissionRuntime } from './runtime'
import { createMissionStore } from './store'
import { missionTestBrain, missionTestClock, missionTestContext } from './runtimeTestSupport'

it('grounds an optional asset reference after project asset discovery', async () => {
  const clock = missionTestClock()
  const journal: MissionJournal = { read: async () => [], append: vi.fn(), flush: vi.fn() }
  const manager = createMissionManager(createMissionStore(journal), createStudioEventBus(), clock)
  const search: AssistantCall = {
    action: 'assets.searchProjectCatalogue',
    input: { type: 'video' },
  }
  const invented: AssistantCall = { action: 'clip.add', input: { assetId: 'invented-video' } }
  const grounded: AssistantCall = { action: 'clip.add', input: { assetId: 'video-1' } }
  const { brain } = missionTestBrain([
    { say: '', calls: [search], cost: 0 },
    { say: '', calls: [invented], cost: 0 },
    { say: '', calls: [grounded], cost: 0 },
    { say: 'Done.', calls: [], cost: 0 },
  ])
  const run = vi.fn(async (call: AssistantCall): Promise<ActionOutcome> => ({
    ok: true,
    data: call.action === 'assets.searchProjectCatalogue' ? [{ id: 'video-1' }] : undefined,
  }))
  const runtime = createMissionRuntime({
    manager,
    context: { build: async ({ mission }) => missionTestContext(mission) },
    brain,
    actions: { run, settle: vi.fn() },
    jobs: { list: () => [] },
    revisions: { read: async () => ({ current: [], unavailable: [] }) },
    clock,
  })

  const mission = await runtime.create('Add the first project video', {})

  expect(run.mock.calls.map(call => call[0])).toEqual([search, grounded])
  expect(JSON.stringify(mission)).toContain('untrustedReference')
})

it('grounds an asset reference in the result of a completed generation job', async () => {
  const clock = missionTestClock()
  const journal: MissionJournal = { read: async () => [], append: vi.fn(), flush: vi.fn() }
  const manager = createMissionManager(createMissionStore(journal), createStudioEventBus(), clock)
  const prepare: AssistantCall = {
    action: 'generator.prepare',
    input: { family: 'video', modelId: 'model-video', parameters: { prompt: 'boat' } },
  }
  const submit: AssistantCall = { action: 'generator.submit', input: {} }
  const add: AssistantCall = {
    action: 'clip.add',
    input: { assetId: 'generated-1', trackId: 'track-1', start: 0 },
  }
  const { brain } = missionTestBrain([
    { say: '', calls: [prepare, submit], cost: 0 },
    { say: '', calls: [add], cost: 0 },
    { say: 'Done.', calls: [], cost: 0 },
  ])
  const run = vi.fn(async (call: AssistantCall): Promise<ActionOutcome> => ({
    ok: true,
    data: call.action === 'generator.submit' ? { jobId: 'job-1' } : undefined,
  }))
  const runtime = createMissionRuntime({
    manager,
    context: { build: async ({ mission }) => missionTestContext(mission) },
    brain,
    actions: { run, settle: vi.fn() },
    jobs: {
      list: () => [
        {
          id: 'job-1',
          targetId: 'model-video',
          label: 'boat',
          status: 'succeeded',
          progress: 1,
          createdAt: clock.now(),
          finishedAt: clock.now(),
          assetIds: ['generated-1'],
        },
      ],
    },
    revisions: { read: async () => ({ current: [], unavailable: [] }) },
    clock,
  })

  await runtime.create('Generate a video and add it to the timeline', {})

  expect(run.mock.calls.map(call => call[0])).toContainEqual(add)
})
