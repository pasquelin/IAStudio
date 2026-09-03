import type { ViewDirection } from '@shared/domain/scene'
import type { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { FrameDriver } from './frameDriver'
import type { SceneDraw } from './studioRender'

const AT_REST = { position: { x: 5, y: 5, z: 5 }, target: { x: 0, y: 0, z: 0 } }

/**
 * Where a canned view stands, five metres out along the axis it looks down. Not what the renderer
 * computes — it frames what is there — but enough that a caller can tell one turn from another.
 */
const FROM: Record<ViewDirection, { x: number; y: number; z: number }> = {
  top: { x: 0, y: 5, z: 0 },
  bottom: { x: 0, y: -5, z: 0 },
  front: { x: 0, y: 0, z: 5 },
  back: { x: 0, y: 0, z: -5 },
  left: { x: -5, y: 0, z: 0 },
  right: { x: 5, y: 0, z: 0 },
}

/** The four methods a running game asks a viewport for — see `SceneDraw`. */
export function drawnBy(over: Partial<SceneDraw> = {}): SceneDraw {
  return {
    apply: () => {},
    placeView: () => {},
    releaseView: () => {},
    viewPlacement: () => AT_REST,
    ...over,
  }
}

/**
 * The eight bytes of a PNG's signature — enough for a caller to file one, and not a picture.
 *
 * 🛑 A rendered image is what a WebGL context makes, and there is none here. What a headless run
 * can honestly stand in for is that the call ANSWERS: `scene.capture` and `document.export` both
 * read the engine off the registry, and an engine without these two refused every still and every
 * export the bench ever asked for — « the scene viewport gave back no still », measured 2026-09-01.
 */
export const PNG_HEAD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * The registry holds a whole `SceneRenderer`, and a game asks it for four methods. Standing in
 * for the rest would mean a WebGL context no suite has got — apart from the two that only have to
 * hand BYTES back, which is what `PNG_HEAD` is for.
 */
export function drawing(over: Partial<SceneDraw> = {}): SceneRenderer {
  let placed = AT_REST

  return {
    ...drawnBy(over),
    captureStill: () => Promise.resolve(PNG_HEAD),
    exportTo: () => Promise.resolve(PNG_HEAD),
    /**
     * 🛑 It MOVES the view rather than answering nothing: `viewPlacement` reads it back, so a
     * caller can tell the turn from a call that did nothing at all. Without any `viewFrom` the
     * action refused on « engine.viewFrom is not a function », which the cast below hides from
     * the compiler — and an empty body would have been the same refusal wearing a pass.
     */
    viewFrom: (direction: ViewDirection) => {
      placed = { position: { ...FROM[direction] }, target: AT_REST.target }
    },
    viewPlacement: () => placed,
  } as unknown as SceneRenderer
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
