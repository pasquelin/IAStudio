import {
  createMission,
  type Mission,
  type MissionClock,
  type MissionId,
} from '@shared/domain/mission'
import type { StudioEvent } from '@shared/domain/studioEvent'
import type { StudioEventBus } from './eventBus'
import type { MissionStore } from './store'

export type MissionScope = { readonly projectId?: string }
export type MissionManager = {
  list: (scope: MissionScope) => Promise<readonly Mission[]>
  create: (goal: string, scope: MissionScope) => Promise<Mission>
  update: (
    id: MissionId,
    expectedRevision: number,
    change: (mission: Mission) => Mission,
  ) => Promise<Mission>
  subscribe: (listener: (mission: Mission) => void) => () => void
  flush: () => Promise<void>
}

const inScope = (mission: Mission, scope: MissionScope): boolean =>
  scope.projectId === undefined
    ? mission.projectId === undefined
    : mission.projectId === scope.projectId

function eventOf(mission: Mission, clock: MissionClock): StudioEvent {
  return {
    id: `event_${clock.newId()}`,
    at: clock.now(),
    state: eventStateOf(mission),
    category: 'mission',
    type: 'mission.state.changed',
    priority: mission.state === 'failed' ? 'important' : 'normal',
    missionId: mission.id,
    messageKey: 'activity.missionStateChanged',
  }
}

function eventStateOf(mission: Mission): StudioEvent['state'] {
  if (
    mission.state === 'completed' ||
    mission.state === 'failed' ||
    mission.state === 'cancelled'
  ) {
    return mission.state
  }
  if (mission.state === 'running') return 'running'
  if (mission.state === 'paused' || mission.state.startsWith('waiting_')) return 'waiting'
  return 'created'
}

export function createMissionManager(
  store: MissionStore,
  events: StudioEventBus,
  clock: MissionClock,
): MissionManager {
  const save = async (mission: Mission): Promise<Mission> => {
    await store.save(mission)
    events.publish(eventOf(mission, clock))
    return mission
  }

  return {
    list: async scope => (await store.list()).filter(mission => inScope(mission, scope)),
    create: async (goal, scope) =>
      await save({
        ...createMission(goal, clock),
        ...(scope.projectId === undefined ? {} : { projectId: scope.projectId }),
      }),
    update: async (id, expectedRevision, change) => {
      const next = await store.update(id, expectedRevision, change)
      events.publish(eventOf(next, clock))
      return next
    },
    subscribe: store.subscribe,
    flush: store.flush,
  }
}

export function missionBelongsToScope(mission: Mission, scope: MissionScope): boolean {
  return inScope(mission, scope)
}
