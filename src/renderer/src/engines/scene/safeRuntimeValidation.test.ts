import { describe, expect, it } from 'vitest'
import {
  SAFE_FUNCTIONAL_CHECKS,
  validateSafeRuntime,
  type SafeFunctionalCheck,
  type SafeRuntimeSnapshot,
} from './safeRuntimeValidation'

const FRAME = { width: 1, height: 1, pixels: new Uint8Array([10, 20, 30, 255]) }
const snapshot = (): SafeRuntimeSnapshot => ({
  picking: { hit: 'source-1' },
  animation: { pose: 1 },
  timeline: { time: 1 },
  scripts: { door: 'open' },
  physics: { body: [1, 2, 3] },
  shadows: { cast: true },
  cameras: { active: 'A' },
  visibility: { source: true },
  postProcessing: { mask: 4 },
  transforms: { source: [1, 0, 0] },
  duplication: { copies: 2 },
  undoRedo: { restored: true },
})

const input = (optimized = snapshot()) => ({
  cameras: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
  renderOriginal: async () => FRAME,
  renderOptimized: async () => FRAME,
  observeOriginal: async () => snapshot(),
  observeOptimized: async () => optimized,
  visualOptions: { channelTolerance: 0, maximumChangedPixelRatio: 0 },
})

describe('SAFE runtime validation', () => {
  it('compares every camera and the complete functional contract in stable order', async () => {
    const report = await validateSafeRuntime(input())
    expect(report.equivalent).toBe(true)
    expect(report.visual.map(result => result.cameraId)).toEqual(['A', 'B', 'C'])
    expect(report.functional.map(result => result.check)).toEqual(SAFE_FUNCTIONAL_CHECKS)
  })

  it.each(SAFE_FUNCTIONAL_CHECKS)('detects an observed %s difference', async check => {
    const optimized = snapshot()
    optimized[check] = { changed: check }
    const report = await validateSafeRuntime(input(optimized))
    expect(report.equivalent).toBe(false)
    expect(report.functional.find(result => result.check === check)).toEqual({
      check: check satisfies SafeFunctionalCheck,
      equivalent: false,
    })
  })

  it('fails when pixels differ despite identical behavior', async () => {
    const report = await validateSafeRuntime({
      ...input(),
      renderOptimized: async () => ({ ...FRAME, pixels: new Uint8Array([30, 20, 30, 255]) }),
    })
    expect(report.equivalent).toBe(false)
  })

  it('refuses to certify a runtime without observing a camera', async () => {
    await expect(validateSafeRuntime({ ...input(), cameras: [] })).rejects.toThrow(
      'at least one camera',
    )
  })
})
