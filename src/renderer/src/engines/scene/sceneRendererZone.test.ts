import { Group, PerspectiveCamera, type Camera } from 'three'
import { describe, expect, it } from 'vitest'
import { SceneRenderer } from './SceneRenderer'
import type { ShadowThrow } from './grouping'

/**
 * Who holds the active zone, and who has to give it back.
 *
 * The preview inset comes through `hideWorkshop` on EVERY frame it is shown, and narrows the zone
 * to its own camera. Left there, the next pane widens it again and answers « cells moved », which
 * `ViewportEngine` turns into `shadowMap.needsUpdate` — every frame, on a still scene.
 */

const rendererOf = (): SceneRenderer =>
  new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    loadModel: async () => new Group(),
  })

/** What the strategy was asked to follow, in order — the only thing a zone is observable by. */
function watching(renderer: SceneRenderer): (Camera | null)[] {
  const seen: (Camera | null)[] = []
  // `as`: the drawing strategy is private by construction, and it is the one being watched.
  const groups = renderer['instances'] as {
    follow?: (camera: Camera | null, cast?: ShadowThrow | null) => boolean
  }
  groups.follow = camera => {
    seen.push(camera)
    return true
  }
  return seen
}

/** A pane, then the preview drawn over it — the two calls a frame with an inset really makes. */
function aFrameWithAnInset(renderer: SceneRenderer, pane: Camera, inset: Camera): void {
  renderer['dressPane'](0, pane as PerspectiveCamera)
  renderer['hideWorkshop'](inset as PerspectiveCamera)()
}

describe('the zone across a frame that draws a preview', () => {
  it('gives it back to the camera the pane left it on', () => {
    const renderer = rendererOf()
    const pane = new PerspectiveCamera()
    const inset = new PerspectiveCamera()
    const seen = watching(renderer)

    aFrameWithAnInset(renderer, pane, inset)

    expect(seen).toEqual([pane, inset, pane])
  })

  it('hands the next frame a zone it has nothing to widen', () => {
    const renderer = rendererOf()
    const pane = new PerspectiveCamera()
    const inset = new PerspectiveCamera()
    const seen = watching(renderer)

    aFrameWithAnInset(renderer, pane, inset)
    aFrameWithAnInset(renderer, pane, inset)

    // 🛑 Three calls a frame, and the pane's two in a row across the seam: the second frame opens
    // on the zone the first left. Without the restore the seam reads `inset` then `pane`, the
    // cells come back, `follow` answers « moved », and every shadow map is drawn again.
    expect(seen).toEqual([pane, inset, pane, pane, inset, pane])
  })

  it('holds the zone for a film, which names no camera and gets every cell', () => {
    const renderer = rendererOf()
    const pane = new PerspectiveCamera()
    const seen = watching(renderer)

    renderer['dressPane'](0, pane as PerspectiveCamera)
    const restore = renderer['hideWorkshop']()

    expect(seen).toEqual([pane, null])

    restore()

    expect(seen).toEqual([pane, null, pane])
  })

  it('asks for nothing before a pane has ever held it', () => {
    const renderer = rendererOf()
    const seen = watching(renderer)

    renderer['hideWorkshop'](new PerspectiveCamera())()

    // Nothing to give back: the restore must not invent a zone no pane has drawn from.
    expect(seen).toHaveLength(1)
  })
})
