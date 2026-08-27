import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { SceneDraw } from './studioRender'

const AT_REST = { position: { x: 5, y: 5, z: 5 }, target: { x: 0, y: 0, z: 0 } }

/** The three methods a running game asks a viewport for — see `SceneDraw`. */
export function drawnBy(over: Partial<SceneDraw> = {}): SceneDraw {
  return { apply: () => {}, placeView: () => {}, viewPlacement: () => AT_REST, ...over }
}

/**
 * The registry holds a whole `SceneRenderer`, and a game asks it for three methods. Standing in
 * for the rest would mean a WebGL context no suite has got.
 */
export function drawing(over: Partial<SceneDraw> = {}): SceneRenderer {
  return drawnBy(over) as unknown as SceneRenderer
}
