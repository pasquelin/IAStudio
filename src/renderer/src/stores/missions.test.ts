import { describe, expect, it } from 'vitest'
import type { Mission } from '@shared/domain/mission'
import { installFakeBridge } from '@/services/fakeBridge'
import { useMissions } from './missions'

const mission = (id: string, projectId: string): Mission => ({
  id,
  revision: 0,
  projectId,
  childIds: [],
  goal: id,
  state: 'created',
  createdAt: '2026-09-04T10:00:00.000Z',
  updatedAt: '2026-09-04T10:00:00.000Z',
  resourceRefs: [],
  plan: { steps: [] },
  waits: [],
  revisionSnapshots: [],
})

describe('mission projection', () => {
  it('restores the watched project and follows its pushed snapshots', async () => {
    let push: ((mission: Mission) => void) | undefined
    installFakeBridge({
      missions: {
        watch: async () => [mission('mission_1', 'project_a')],
        onChanged: listener => {
          push = listener
          return () => {}
        },
      },
    })

    await useMissions.getState().connectMissions({ projectId: 'project_a' })
    push?.(mission('mission_2', 'project_a'))

    expect(useMissions.getState().missions.map(item => item.id)).toEqual(['mission_1', 'mission_2'])
  })

  it('replaces the projection when the workspace changes', async () => {
    installFakeBridge({
      missions: {
        watch: async scope => [mission('mission_2', scope.projectId ?? 'global')],
      },
    })

    await useMissions.getState().connectMissions({ projectId: 'project_b' })

    expect(useMissions.getState().missions).toEqual([mission('mission_2', 'project_b')])
  })

  it('merges a push arriving while the initial projection is in flight', async () => {
    let push: ((mission: Mission) => void) | undefined
    let answer: ((missions: readonly Mission[]) => void) | undefined
    installFakeBridge({
      missions: {
        watch: () => new Promise(resolve => (answer = resolve)),
        onChanged: listener => {
          push = listener
          return () => {}
        },
      },
    })
    const connecting = useMissions.getState().connectMissions({ projectId: 'project_a' })
    push?.(mission('mission_2', 'project_a'))
    answer?.([mission('mission_1', 'project_a')])
    await connecting

    expect(useMissions.getState().missions.map(item => item.id)).toEqual(['mission_1', 'mission_2'])
  })

  it('ignores a stale project response and its late pushes', async () => {
    const answers = new Map<string, (missions: readonly Mission[]) => void>()
    const listeners: Array<(mission: Mission) => void> = []
    installFakeBridge({
      missions: {
        watch: scope =>
          new Promise(resolve => {
            answers.set(scope.projectId ?? 'global', resolve)
          }),
        onChanged: listener => {
          listeners.push(listener)
          return () => {}
        },
      },
    })
    const projectA = useMissions.getState().connectMissions({ projectId: 'project_a' })
    const projectB = useMissions.getState().connectMissions({ projectId: 'project_b' })
    answers.get('project_b')?.([mission('mission_b', 'project_b')])
    await projectB
    answers.get('project_a')?.([mission('mission_a', 'project_a')])
    listeners[0]?.(mission('mission_a_push', 'project_a'))
    await projectA

    expect(useMissions.getState().missions).toEqual([mission('mission_b', 'project_b')])
  })

  it('stops a pending projection synchronously when disconnected', async () => {
    let answer: ((missions: readonly Mission[]) => void) | undefined
    let push: ((mission: Mission) => void) | undefined
    let stopCount = 0
    installFakeBridge({
      missions: {
        watch: () => new Promise(resolve => (answer = resolve)),
        onChanged: listener => {
          push = listener
          return () => {
            stopCount += 1
          }
        },
      },
    })
    const connecting = useMissions.getState().connectMissions({ projectId: 'project_a' })
    useMissions.getState().disconnectMissions()
    push?.(mission('mission_a_push', 'project_a'))
    answer?.([mission('mission_a', 'project_a')])
    const stop = await connecting
    stop()

    expect(stopCount).toBe(1)
    expect(useMissions.getState().missions).not.toContainEqual(mission('mission_a', 'project_a'))
  })

  it('ignores a created mission after its project connection changes', async () => {
    let answer: ((mission: Mission) => void) | undefined
    installFakeBridge({
      missions: {
        watch: async () => [],
        create: () => new Promise(resolve => (answer = resolve)),
      },
    })
    await useMissions.getState().connectMissions({ projectId: 'project_a' })
    const creating = useMissions.getState().createMission('Late')
    await useMissions.getState().connectMissions({ projectId: 'project_b' })
    answer?.(mission('mission_a', 'project_a'))
    await creating

    expect(useMissions.getState().missions).toEqual([])
  })
})
