import type { AutoRigInferenceResult } from '@shared/domain/autoRigInference'
import { AutoRigService } from './autoRig'
import { makeItAnimatableBackend } from './makeItAnimatableBackend'
import { simpleAutoRigBackend } from './simpleAutoRigBackend'
import type { AutoRigBackend } from './autoRig'

type AutoRigInput = Record<string, never>

export function autoRigServiceFor(
  runSimple: AutoRigBackend<AutoRigInput>['run'],
  infer: (backendId: string, signal: AbortSignal) => Promise<AutoRigInferenceResult>,
): AutoRigService<AutoRigInput> {
  return new AutoRigService([
    simpleAutoRigBackend(runSimple),
    makeItAnimatableBackend((_input, signal) => infer('make-it-animatable', signal)),
  ])
}
