import { describe, expect, it } from 'vitest'
import source from './SceneRenderer.ts?raw'

/**
 * What the camera preview's cache rests on, and what nothing else can hold.
 *
 * The engine reuses the picture it drew for the preview on every frame where what a scene camera
 * FILMS has not moved — an orbit, a fly, damping settling. Two named intents say which is which:
 * `redraw` for the scene, `repaint` for the workshop drawn over it. A bare `requestRender` is
 * neither, and would leave the monitor showing an instant that is gone with nothing to notice.
 *
 * Read as text because that is the only way to see the ABSENCE of a call. The engine cannot be
 * built without a WebGL context, and a test that drove it would only ever cover the paths it
 * happened to take.
 */
describe('SceneRenderer and the preview it invalidates', () => {
  const REDRAW = /private redraw\(\): void \{[\s\S]*?\n {2}\}/
  const REPAINT = /private repaint\(\): void \{[\s\S]*?\n {2}\}/

  /**
   * The NAME and not the call: `createEnvironment` and the three texture binders are handed
   * `requestRender` as a callback, and a skybox or a map landing changes what the camera films
   * just as much as an edit does. Reading only `requestRender()` left those four passing the
   * viewport's own method straight through, and the preview kept the instant before.
   */
  it('asks for every frame through `redraw` or `repaint`, never through the viewport directly', () => {
    const elsewhere = source
      .replace(REDRAW, '')
      .replace(REPAINT, '')
      .split('\n')
      .map((line, at) => ({ line: line.trim(), at: at + 1 }))
      .filter(({ line }) => line.includes('viewport.requestRender'))

    expect(elsewhere).toEqual([])
  })

  it('invalidates the preview in `redraw`, and leaves it alone in `repaint`', () => {
    const redraw = REDRAW.exec(source)?.[0] ?? ''
    const repaint = REPAINT.exec(source)?.[0] ?? ''

    expect(redraw).toContain('this.viewport.invalidateInset()')
    expect(redraw).toContain('this.viewport.requestRender()')
    expect(repaint).toContain('this.viewport.requestRender()')
    expect(repaint).not.toContain('invalidateInset')
  })
})
