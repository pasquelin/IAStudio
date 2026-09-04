import { describe, expect, it, vi } from 'vitest'
import {
  addMissionStep,
  createMission,
  createMissionStep,
  type Mission,
  type MissionClock,
  type MissionStep,
} from '@shared/domain/mission'
import { createStudioEventBus } from './eventBus'
import { createMissionManager, type MissionManager } from './manager'
import { createMissionScheduler, readyMissionSteps, type MissionStepOutcome } from './scheduler'
import { createMissionStore } from './store'
import type { MissionJournal } from './journal'

function clock(): MissionClock {
  let id = 0
  return { now: () => '2026-09-04T10:00:00.000Z', newId: () => String(++id) }
}

function manager(time: MissionClock, initial: readonly Mission[] = []): MissionManager {
  const journal: MissionJournal = { read: async () => initial, append: vi.fn(), flush: vi.fn() }
  return createMissionManager(createMissionStore(journal), createStudioEventBus(), time)
}

function withAction(
  mission: Mission,
  time: MissionClock,
  label: string,
  dependsOn: readonly string[] = [],
) {
  return addMissionStep(
    mission,
    createMissionStep(
      mission.id,
      label,
      { kind: 'action', call: { action: 'project.create', input: {} } },
      time,
      dependsOn,
    ),
    time.now(),
  )
}

describe('mission scheduler', () => {
  it('makes only dependency-free pending steps ready', () => {
    const time = clock()
    let mission = withAction(createMission('Ordered', time), time, 'First')
    mission = withAction(mission, time, 'Second', [mission.plan.steps[0]?.id ?? 'missing'])

    expect(readyMissionSteps(mission).map(step => step.title)).toEqual(['First'])
  })

  it('runs a mission in dependency order until completion', async () => {
    const time = clock()
    let mission = withAction(createMission('Ordered', time), time, 'First')
    mission = withAction(mission, time, 'Second', [mission.plan.steps[0]?.id ?? 'missing'])
    const missions = manager(time, [mission])
    const labels: string[] = []
    const scheduler = createMissionScheduler(
      missions,
      async step => {
        labels.push(step.title)
        return { kind: 'completed' }
      },
      time,
    )

    await scheduler.wake(mission.id)

    expect(labels).toEqual(['First', 'Second'])
    expect(await missions.read(mission.id)).toMatchObject({ state: 'completed' })
  })

  it('waits for user input and resumes the same step', async () => {
    const time = clock()
    const missions = manager(time)
    const created = await missions.create('Question', {})
    const step = createMissionStep(created.id, 'Ask', { kind: 'user_input' }, time)
    await missions.update(created.id, created.revision, current =>
      addMissionStep(current, step, time.now()),
    )
    let answer: MissionStepOutcome = { kind: 'waiting', wait: { kind: 'user', stepId: step.id } }
    const scheduler = createMissionScheduler(missions, async () => answer, time)

    await scheduler.wake(created.id)
    expect(await missions.read(created.id)).toMatchObject({ state: 'waiting_user' })
    answer = { kind: 'completed' }
    await scheduler.resume(created.id, step.id)

    expect(await missions.read(created.id)).toMatchObject({ state: 'completed', waits: [] })
  })

  it('persists a step result and turns a runner error into mission failure', async () => {
    const time = clock()
    const successful = withAction(createMission('Result', time), time, 'Return')
    const broken = withAction(createMission('Failure', time), time, 'Throw')
    const missions = manager(time, [successful, broken])
    const scheduler = createMissionScheduler(
      missions,
      async step => {
        if (step.missionId === broken.id) throw new Error('runner broke')
        return { kind: 'completed', result: { assetId: 'asset_1' } }
      },
      time,
    )

    await scheduler.wake(successful.id)
    await scheduler.wake(broken.id)

    expect((await missions.read(successful.id))?.plan.steps[0]?.result).toEqual({
      assetId: 'asset_1',
    })
    expect(await missions.read(broken.id)).toMatchObject({
      state: 'failed',
      plan: { steps: [{ state: 'failed', error: 'Error: runner broke' }] },
    })
  })

  it('reattaches a persisted job wait and resumes from its job identifier', async () => {
    const time = clock()
    const created = createMission('Job', time)
    const step = createMissionStep(created.id, 'Render', { kind: 'job', jobId: 'job_1' }, time)
    const mission = addMissionStep(created, step, time.now())
    const missions = manager(time, [mission])
    let outcome: MissionStepOutcome = {
      kind: 'waiting',
      wait: { kind: 'job', stepId: step.id, jobId: 'job_1' },
    }
    const scheduler = createMissionScheduler(missions, async () => outcome, time)

    await scheduler.wake(mission.id)
    expect(await missions.read(mission.id)).toMatchObject({ state: 'waiting_job' })
    await expect(scheduler.resume(mission.id, step.id)).rejects.toThrow('does not wait on the user')
    outcome = { kind: 'completed' }
    await expect(scheduler.resumeJob(mission.id, 'job_other')).rejects.toThrow(
      'does not wait on job job_other',
    )
    await Promise.all([
      scheduler.resumeJob(mission.id, 'job_1'),
      scheduler.resumeJob(mission.id, 'job_1'),
    ])

    expect(await missions.read(mission.id)).toMatchObject({ state: 'completed' })
    const revision = (await missions.read(mission.id))?.revision
    await scheduler.resumeJob(mission.id, 'job_1')
    expect((await missions.read(mission.id))?.revision).toBe(revision)
  })

  it('coalesces simultaneous wakes of the same mission', async () => {
    const time = clock()
    const mission = withAction(createMission('Once', time), time, 'Only')
    const missions = manager(time, [mission])
    const runner = vi.fn(async (): Promise<MissionStepOutcome> => ({ kind: 'completed' }))
    const scheduler = createMissionScheduler(missions, runner, time)

    await Promise.all([scheduler.wake(mission.id), scheduler.wake(mission.id)])

    expect(runner).toHaveBeenCalledOnce()
  })

  it('fails rather than attaching a wait returned for another step', async () => {
    const time = clock()
    const mission = withAction(createMission('Wrong wait', time), time, 'Only')
    const missions = manager(time, [mission])
    const scheduler = createMissionScheduler(
      missions,
      async () => ({ kind: 'waiting', wait: { kind: 'user', stepId: 'step_other' } }),
      time,
    )

    await scheduler.wake(mission.id)

    expect(await missions.read(mission.id)).toMatchObject({ state: 'failed' })
  })

  it('persists failure for a wait whose kind does not match its step', async () => {
    const time = clock()
    const created = createMission('Wrong job', time)
    const step = createMissionStep(created.id, 'Render', { kind: 'job', jobId: 'job_1' }, time)
    const mission = addMissionStep(created, step, time.now())
    const missions = manager(time, [mission])
    const scheduler = createMissionScheduler(
      missions,
      async () => ({
        kind: 'waiting',
        wait: { kind: 'job', stepId: step.id, jobId: 'job_other' },
      }),
      time,
    )

    await scheduler.wake(mission.id)

    expect(await missions.read(mission.id)).toMatchObject({ state: 'failed' })
  })

  it('ignores a sibling result after another parallel step fails', async () => {
    const time = clock()
    let mission = withAction(createMission('Parallel failure', time), time, 'Failure')
    mission = withAction(mission, time, 'Sibling')
    const missions = manager(time, [mission])
    let release = (): void => {}
    let siblingSignal: AbortSignal | undefined
    const scheduler = createMissionScheduler(
      missions,
      async (step, signal) => {
        if (step.title === 'Failure') return { kind: 'failed', error: 'failed' }
        siblingSignal = signal
        await new Promise<void>(resolve => {
          release = resolve
        })
        return { kind: 'completed' }
      },
      time,
    )
    const running = scheduler.wake(mission.id)
    await vi.waitFor(async () => expect((await missions.read(mission.id))?.state).toBe('failed'))
    release()

    await expect(running).resolves.toBeUndefined()
    expect(siblingSignal?.aborted).toBe(true)
  })

  it('limits concurrent steps across simultaneous missions', async () => {
    const time = clock()
    const missions = manager(time)
    const first = await missions.create('First', {})
    const second = await missions.create('Second', {})
    const add = async (mission: Mission): Promise<void> => {
      const one = createMissionStep(mission.id, 'One', { kind: 'reason' }, time)
      const two = createMissionStep(mission.id, 'Two', { kind: 'reason' }, time)
      await missions.update(mission.id, mission.revision, current =>
        addMissionStep(addMissionStep(current, one, time.now()), two, time.now()),
      )
    }
    await add(first)
    await add(second)
    let active = 0
    let peak = 0
    const releases: Array<() => void> = []
    const runner = async (_step: MissionStep): Promise<MissionStepOutcome> => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise<void>(resolve => releases.push(resolve))
      active -= 1
      return { kind: 'completed' }
    }
    const scheduler = createMissionScheduler(missions, runner, time, 2)
    const running = Promise.all([scheduler.wake(first.id), scheduler.wake(second.id)])
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.splice(0).forEach(release => release())
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.splice(0).forEach(release => release())
    await running

    expect(peak).toBe(2)
  })

  it('aborts active work and leaves the mission cancelled', async () => {
    const time = clock()
    const missions = manager(time)
    const created = await missions.create('Cancel', {})
    const step = createMissionStep(created.id, 'Long', { kind: 'reason' }, time)
    await missions.update(created.id, created.revision, current =>
      addMissionStep(current, step, time.now()),
    )
    let release = (): void => {}
    let observedAborted = false
    const scheduler = createMissionScheduler(
      missions,
      async (_step, signal) => {
        await new Promise<void>(resolve => {
          release = resolve
        })
        observedAborted = signal.aborted
        return { kind: 'completed' }
      },
      time,
    )
    const running = scheduler.wake(created.id)
    await vi.waitFor(async () =>
      expect((await missions.read(created.id))?.plan.steps[0]?.state).toBe('running'),
    )
    await scheduler.cancel(created.id)
    release()
    await running

    expect(observedAborted).toBe(true)
    expect(await missions.read(created.id)).toMatchObject({ state: 'cancelled' })
  })
})
