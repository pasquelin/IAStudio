import { create } from 'zustand'
import type { Mission } from '@shared/domain/mission'
import type { MissionScope } from '@shared/studioBridgeMissions'
import { getBridge } from '@/services/bridge'

type MissionsState = {
  missions: readonly Mission[]
  connectMissions: (scope: MissionScope) => Promise<() => void>
  disconnectMissions: () => void
  createMission: (goal: string) => Promise<void>
}

export const useMissions = create<MissionsState>()((set, get) => {
  let activeConnection = 0
  let activeScope: MissionScope | undefined
  let activeStop = (): void => {}
  const disconnectMissions = (): void => {
    activeConnection += 1
    activeScope = undefined
    activeStop()
    activeStop = () => {}
  }
  return {
    missions: [],
    connectMissions: async scope => {
      activeStop()
      activeStop = () => {}
      const connection = ++activeConnection
      activeScope = scope
      const bridge = getBridge()
      if (!bridge) return () => {}
      const belongsToScope = (mission: Mission): boolean => mission.projectId === scope.projectId
      const pushed = new Map<string, Mission>()
      const unsubscribe = bridge.missions.onChanged(changed => {
        if (connection !== activeConnection || !belongsToScope(changed)) return
        pushed.set(changed.id, changed)
        set(state => ({
          missions: [...state.missions.filter(mission => mission.id !== changed.id), changed],
        }))
      })
      let stopped = false
      const stop = (): void => {
        if (stopped) return
        stopped = true
        unsubscribe()
      }
      activeStop = stop
      const missions = await bridge.missions.watch(scope)
      if (connection === activeConnection) {
        set({
          missions: [
            ...missions.filter(mission => belongsToScope(mission) && !pushed.has(mission.id)),
            ...pushed.values(),
          ],
        })
      }
      return () => {
        if (connection === activeConnection) disconnectMissions()
        else stop()
      }
    },
    disconnectMissions,
    createMission: async goal => {
      const bridge = getBridge()
      const connection = activeConnection
      const scope = activeScope
      if (!bridge || !scope) return
      const created = await bridge.missions.create(goal)
      if (
        connection === activeConnection &&
        created.projectId === scope.projectId &&
        !get().missions.some(mission => mission.id === created.id)
      ) {
        set(state => ({ missions: [...state.missions, created] }))
      }
    },
  }
})
