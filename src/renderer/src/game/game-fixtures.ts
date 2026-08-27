import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { FrameDriver } from './playSession'
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

/**
 * The frames a suite drives by hand, in place of the browser's.
 *
 * 🛑 In SECONDS from the start, and a caller stepping one second at a time measures a quarter of
 * one: `MAX_FRAME_SECONDS` clamps a late frame, so a game is driven at sixty a second or not at all.
 */
export function handDriven() {
  let frame: ((nowMs: number) => void) | null = null
  let stopped = false

  return {
    driver: {
      start: given => {
        frame = given
      },
      stop: () => {
        stopped = true
      },
    } satisfies FrameDriver,
    stopped: () => stopped,
    advance: (seconds: number) => frame?.(seconds * 1000),
    /** That many frames at sixty a second, starting from the one after `from`. */
    run: (frames: number, from = 0) => {
      for (let at = 0; at < frames; at += 1) frame?.(((from + at) / 60) * 1000)
    },
  }
}
