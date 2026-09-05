import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTO_RIG_OPTIONS } from './autoRigInference'

describe('Auto Rig inference defaults', () => {
  it('uses the upstream-safe fallback for stylized or joined fingers', () => {
    expect(DEFAULT_AUTO_RIG_OPTIONS).toEqual({
      fingers: 'simplified',
      useSurfaceNormals: false,
      weightPostProcessing: true,
    })
  })
})
