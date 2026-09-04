import type { MissionId, MissionStepId } from './mission'
import type { ActivityMessageKey, ActivityParams } from './activity'
import type { Ref } from './ref'

export type StudioEventState =
  'created' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled'

export type StudioEventCategory =
  | 'assistant'
  | 'mission'
  | 'step'
  | 'action'
  | 'job'
  | 'file'
  | 'project'
  | 'document'
  | 'scene'
  | 'generation'
  | 'memory'
  | 'system'

export type StudioEventPriority = 'background' | 'normal' | 'important' | 'critical'

export type StudioEventProgress = {
  current?: number
  total?: number
  ratio?: number
}

export type StudioEvent = {
  id: string
  at: string
  state: StudioEventState
  category: StudioEventCategory
  type: string
  priority: StudioEventPriority
  missionId?: MissionId
  stepId?: MissionStepId
  messageKey: ActivityMessageKey
  params?: ActivityParams
  progress?: StudioEventProgress
  refs?: readonly Ref[]
}
