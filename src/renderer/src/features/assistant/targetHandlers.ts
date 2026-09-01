import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'
import { aimAt } from './documentTargets'

function select(input: Record<string, unknown>): ActionOutcome {
  const id = textOf(input, 'aimId')
  return id === null
    ? refused(
        'badInput',
        '"aimId" is wanted — the id of a layer, a node, a clip or a row of the document in front, as canvas.state, scene.state and sequence.state answer them',
      )
    : aimAt(id)
}

export const TARGET_HANDLERS: ActionHandlers = { 'target.select': select }
