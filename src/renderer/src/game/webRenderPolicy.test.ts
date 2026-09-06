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

  /**
   * Left to itself three.js redraws every map of every casting light on every frame — what a
   * level nobody walks in was paying sixty times a second for a picture that does not move.
   */
  it('draws a depth pass on the frames that owe one, never on all of them', () => {
    expect(code).toContain('renderer.shadowMap.autoUpdate = false')
    expect(code).toContain('renderer.shadowMap.needsUpdate = shadowsStale || settled')
  })

  /**
   * `SceneWorld.post` is a scene's own chain — grade, grain, bloom. The editor draws every
   * surface through `PostComposer`; a game that called `render` alone showed the scene ungraded,
   * and nothing compared the two pictures.
   */
  it('draws a scene that asks for effects through the composer the editor uses', () => {
    expect(code).toContain('stackDraws(held.world.post)')
    expect(code).toContain('composer.draw({')
    expect(code).toContain("await import('@/engines/postfx/PostComposer')")
  })

  it('composes at the size of the drawing buffer, never at the CSS size of the canvas', () => {
    expect(code).toContain('Math.round(sized.width * renderer.getPixelRatio())')
  })

  it('falls back to the plain pass, so a chain still loading never blanks the picture', () => {
    expect(code).toContain('} else renderer.render(held.scene, camera)')
  })

  it('settles the scene BEFORE reading the flag, or a short-circuit skips the pruning', () => {
    const draw = code.slice(code.indexOf('draw: () => {'))
    expect(draw.indexOf('held.flush(camera)')).toBeLessThan(draw.indexOf('shadowMap.needsUpdate'))
  })
})
