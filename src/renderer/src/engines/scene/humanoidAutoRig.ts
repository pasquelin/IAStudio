import type { Rig } from '@shared/domain/rig'
import type { AdaptiveRigResult } from './adaptiveGeometricRig'
import type { AdaptiveRigFitter } from './adaptiveRigFitter'
import { rigFit } from './rigFit'
import { rigSnappedTo, type MeshSample } from './rigSnap'

export type HumanoidAutoRigBackend = 'legacy' | 'adaptive-geometric'

export type HumanoidAutoRigResult = {
  rig: Rig | null
  analysis: AdaptiveRigResult | null
}

export async function fitHumanoidRig(
  sample: MeshSample,
  backend: HumanoidAutoRigBackend,
  adaptive: AdaptiveRigFitter,
  signal?: AbortSignal,
): Promise<HumanoidAutoRigResult | null> {
  if (backend === 'adaptive-geometric') {
    const analysis = await adaptive.fit(sample, signal)
    return analysis ? { rig: analysis.validation.accepted ? analysis.rig : null, analysis } : null
  }
  return { rig: rigSnappedTo(rigFit(sample.bounds), sample), analysis: null }
}

export function humanoidAutoRigBackend(
  development: boolean,
  requested: string | null,
): HumanoidAutoRigBackend {
  return development && requested === 'adaptive-geometric' ? 'adaptive-geometric' : 'legacy'
}
