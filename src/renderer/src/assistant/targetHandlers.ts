import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'
import { aimAt } from './documentTargets'

function select(input: Record<string, unknown>): ActionOutcome {
  const id = textOf(input, 'aimId')
  return id === null ? refused('badInput') : aimAt(id)
}

export const TARGET_HANDLERS: ActionHandlers = { 'target.select': select }
