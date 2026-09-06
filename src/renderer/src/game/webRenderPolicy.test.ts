import { describe, expect, it } from 'vitest'
import source from './webRender.ts?raw'

/**
 * The seam no jsdom test can reach: `createWebRender` builds a real `WebGLRenderer`. What the
 * writes THEMSELVES do is tested against a double in `shadows.test.ts`; this holds that the game
 * still calls them. 🛑 Both spellings of a comment are stripped — a commented-out call read as
 * live is exactly how such a guard passes on dead code.
 */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('what an exported game pays for an image', () => {
  it('tells the renderer what the policy says, through the pass both engines share', () => {
    expect(code).toContain('applyShadowPolicy(renderer, policy)')
  })

  it('holds the pixel ratio to what the quality level pays for', () => {
    expect(code).toContain('Math.min(pixelRatioFor(policy.quality)')
  })

  it('tunes the shadow maps of a scene it puts on, or every light keeps three.js defaults', () => {
    expect(code).toContain('tuneSceneShadows(built, policy)')
    expect(code).toContain('shadowMapSizeFor(policy.quality, policy.shadowMapSize)')
  })

  /** A frustum cut to the scatter spreads one map over kilometres — see `shadowBoundsOf`. */
  it('cuts that frustum to what DRAWS, never to everything the scene holds', () => {
    expect(code).toContain('gameShadowReach(built.shadowBounds)')
  })

  /**
   * Left to itself three.js redraws every map of every casting light on every frame — what a
   * level nobody walks in was paying sixty times a second for a picture that does not move.
   */
  it('draws a depth pass on the frames that owe one, never on all of them', () => {
    expect(code).toContain('renderer.shadowMap.needsUpdate = shadowsStale || changed')
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
