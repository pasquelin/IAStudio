import { describe, expect, it } from 'vitest'
import { gpuName } from './gpuName'

describe('gpuName', () => {
  // What `app.getGPUInfo` answered on this Mac, 2026-08-21. Read whole, the line of the manager
  // was three quarters driver build.
  it('takes the chip out of what Chromium answers', () => {
    expect(
      gpuName('ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2 (Build 25F84))'),
    ).toBe('Apple M2 Max')
  })

  // A machine that answered something else answered it for a reason: it is shown as it came.
  it('hands back anything that is not shaped like that', () => {
    expect(gpuName('NVIDIA GeForce RTX 4090')).toBe('NVIDIA GeForce RTX 4090')
  })
})
