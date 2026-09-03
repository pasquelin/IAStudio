import type { AdaptiveRigResult } from './adaptiveGeometricRig'
import type { MeshSample } from './rigSnap'

export type AdaptiveRigRequest = { id: number; sample: MeshSample }
export type AdaptiveRigIncoming = AdaptiveRigRequest | { id: number; cancel: true }
export type AdaptiveRigResponse =
  | { id: number; done: true; ok: true; result: AdaptiveRigResult }
  | { id: number; done: true; ok: false; error: string }

export function isAdaptiveRigCancel(
  message: AdaptiveRigIncoming,
): message is { id: number; cancel: true } {
  return 'cancel' in message
}
