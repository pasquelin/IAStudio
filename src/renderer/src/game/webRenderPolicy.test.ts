import { describe, expect, it } from 'vitest'
import source from './webRender.ts?raw'

/**
 * The seam no jsdom test can reach: `createWebRender` builds a real `WebGLRenderer`. Read as
 * source, like `webRenderScatter.test.ts` does, so the three lines that make an exported game
 * cost what the editor costs cannot be dropped in silence. Comments are stripped first: a
 * commented-out call read as live is exactly how such a guard passes on dead code.
 */
const code = source.replace(/\/\/.*$/gm, '')

describe('what an exported game pays for an image', () => {
  it('draws shadows only when the policy says so, never on a flag written here', () => {
    expect(code).toContain('renderer.shadowMap.enabled = policy.shadows')
    expect(code).toContain('applyShadowQuality(renderer, policy.shadowQuality)')
  })

  it('holds the pixel ratio to what the quality level pays for', () => {
    expect(code).toContain('Math.min(pixelRatioFor(policy.quality)')
  })

  it('tunes the shadow maps of a scene it puts on, or every light keeps three.js defaults', () => {
    expect(code).toContain('tuneSceneShadows(built.scene, policy)')
    expect(code).toContain('shadowMapSizeFor(policy.quality, policy.shadowMapSize)')
  })
})
