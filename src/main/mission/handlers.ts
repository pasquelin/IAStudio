import type { WebContents } from 'electron'
import { CHANNELS, EVENTS } from '@shared/ipc'
import type { MissionScope } from '@shared/studioBridgeMissions'
import { sendToSender } from '@main/ipc/broadcast'
import { handle } from '@main/ipc/handle'
import { missionBelongsToScope, type MissionManager } from './manager'

function parseScope(value: unknown): MissionScope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('mission scope must be an object')
  }
  if (!('projectId' in value) || value.projectId === undefined) return {}
  if (typeof value.projectId !== 'string' || value.projectId.length === 0) {
    throw new Error('mission project id must be a non-empty string')
  }
  return { projectId: value.projectId }
}

function parseGoal(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 10_000) {
    throw new Error('mission goal must be a non-empty bounded string')
  }
  return value
}

export function registerMissionHandlers(manager: MissionManager): void {
  const scopes = new Map<number, { readonly sender: WebContents; readonly scope: MissionScope }>()
  manager.subscribe(mission => {
    for (const projection of scopes.values()) {
      if (missionBelongsToScope(mission, projection.scope)) {
        sendToSender(projection.sender, EVENTS.missionChanged, mission)
      }
    }
  })

  handle(CHANNELS.missionsWatch, async (event, value) => {
    const scope = parseScope(value)
    const senderId = event.sender.id
    scopes.set(senderId, { sender: event.sender, scope })
    event.sender.once('destroyed', () => scopes.delete(senderId))
    return await manager.list(scope)
  })

  handle(CHANNELS.missionsCreate, (event, goal) => {
    const projection = scopes.get(event.sender.id)
    if (!projection) throw new Error('window must watch missions before creating one')
    return manager.create(parseGoal(goal), projection.scope)
  })
}
