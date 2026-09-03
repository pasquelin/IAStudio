import { describe, expect, it } from 'vitest'
import { adaptiveGeometricRig } from './adaptiveGeometricRig'
import type { AdaptiveRigFitter } from './adaptiveRigFitter'
import { fitHumanoidRig, humanoidAutoRigBackend } from './humanoidAutoRig'

const SAMPLE = {
  bounds: { min: { x: -0.2, y: 0, z: -0.1 }, max: { x: 0.2, y: 1, z: 0.1 } },
  points: new Float32Array([
    -0.2, 0, -0.1, 0.2, 0, 0.1, -0.2, 0.2, -0.1, 0.2, 0.2, 0.1, -0.2, 0.4, -0.1, 0.2, 0.4, 0.1,
    -0.2, 0.6, -0.1, 0.2, 0.6, 0.1, -0.2, 0.8, -0.1, 0.2, 0.8, 0.1, -0.2, 1, -0.1, 0.2, 1, 0.1,
  ]),
}

const ADAPTIVE: AdaptiveRigFitter = {
  fit: async sample => adaptiveGeometricRig(sample),
  dispose: () => undefined,
}

describe('humanoid auto-rig backends', () => {
  it('keeps legacy as the production default and only enables the spike when development asks', () => {
    expect(humanoidAutoRigBackend(false, 'adaptive-geometric')).toBe('legacy')
    expect(humanoidAutoRigBackend(true, null)).toBe('legacy')
    expect(humanoidAutoRigBackend(true, 'adaptive-geometric')).toBe('adaptive-geometric')
  })

  it('keeps both fitters behind one Rig-compatible result', async () => {
    expect((await fitHumanoidRig(SAMPLE, 'legacy', ADAPTIVE))?.analysis).toBeNull()
    expect(
      (await fitHumanoidRig(SAMPLE, 'adaptive-geometric', ADAPTIVE))?.analysis?.rig.origin,
    ).toBe('local')
  })

  it('refuses a mesh with no height to stand a body on, whichever fitter is asked', async () => {
    const flat = {
      bounds: { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 0, z: 1 } },
      points: SAMPLE.points,
    }

    expect(await fitHumanoidRig(flat, 'legacy', ADAPTIVE)).toBeNull()
    expect(await fitHumanoidRig(flat, 'adaptive-geometric', ADAPTIVE)).toBeNull()
  })

  it('returns rejected evidence without handing its rig to the caller', async () => {
    const rejected: AdaptiveRigFitter = {
      fit: async sample => ({
        ...adaptiveGeometricRig(sample),
        validation: { accepted: false, issues: [{ code: 'outside-body', bone: 'Head' }] },
      }),
      dispose: () => undefined,
    }

    const result = await fitHumanoidRig(SAMPLE, 'adaptive-geometric', rejected)

    expect(result?.rig).toBeNull()
    expect(result?.analysis?.validation.accepted).toBe(false)
  })
})
