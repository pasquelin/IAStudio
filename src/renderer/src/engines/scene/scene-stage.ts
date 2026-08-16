import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { Us } from '@shared/domain/time'
import { reportFailure } from '@/services/diagnostics'
import { SceneRenderer } from './SceneRenderer'
import { firstCameraId, type SceneState } from './scene-state'

/**
 * How far off screen the host sits. Off the page rather than hidden: a host with
 * `display: none` — or one inside a zero-sized box — measures zero, and the viewport would size
 * its buffer to nothing and draw an empty frame.
 */
const OFF_SCREEN = '-20000px'

/**
 * A scene rendered somewhere no one is looking, so a montage can show it.
 *
 * Its own WebGL context, and there is no way around that: a context cannot be shared between two
 * canvases, and the montage's own surface belongs to Pixi. It is the reason a stage is opened per
 * scene actually on screen and closed as soon as the montage stops asking for it — a browser
 * grants a page a handful of contexts, not one per clip.
 */
export type SceneStage = {
  /** Rebuilds what the scene holds. Cheap when the document has not changed — see `apply`. */
  show: (state: SceneState) => void
  /** Draws the instant asked for and hands back the canvas it landed on, undisturbed. */
  draw: (time: Us) => HTMLCanvasElement | null
  dispose: () => void
}

export type SceneStageOptions = {
  width: number
  height: number
  /**
   * What clips a model brought, once its file has landed — the only way to learn them, since
   * they live in the file and not in the document. A lone model dropped on a montage is played
   * through this; a scene document already says what it plays.
   */
  onClips?: (nodeId: string, clips: readonly string[]) => void
  /** Absent builds a real one; a test hands a stub, since jsdom has no WebGL at all. */
  createRenderer?: () => SceneRenderer
}

/**
 * Opens a stage: a host off screen, a renderer on it, and nothing else.
 *
 * The renderer is transparent and drawn at exactly one device pixel per asked-for pixel: what
 * comes out is composited over the clips underneath, at the sequence's own resolution.
 */
export function createSceneStage({
  width,
  height,
  onClips,
  createRenderer,
}: SceneStageOptions): SceneStage {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = OFF_SCREEN
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.height = `${height}px`
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)

  let renderer: SceneRenderer | null = null
  let failed = false

  /**
   * Built on the first frame asked for, never when the stage opens.
   *
   * The pool writes a source off as undecodable FOR THE SESSION when opening it throws, and a
   * WebGL context that could not be had — one too many, a driver that said no — would then
   * black out the clip for good with « media not found ». Deferred, the worst case is a clip
   * that draws nothing, and the reason lands in the journal where it can be read.
   */
  const engine = (): SceneRenderer | null => {
    if (renderer || failed) return renderer

    try {
      renderer =
        createRenderer?.() ??
        new SceneRenderer({
          // Nothing here selects or transforms anything: a stage is watched, never clicked.
          onSelect: () => {},
          onTransform: () => {},
          onClips: (nodeId, clips) => onClips?.(nodeId, clips),
        })

      renderer.prepareOffscreen({ alpha: true, pixelRatio: 1 })
      renderer.mount(host)
      // No grid and no ground: a montage wants the scene, not the workshop it was built in.
      renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false })
    } catch (error) {
      // Once: a montage asks sixty times a second, and a journal filling at that rate hides the
      // very line someone opened it to read.
      failed = true
      renderer = null
      reportFailure('scene.render', 'montage', error)
    }
    return renderer
  }

  let shown: SceneState | null = null
  let framed = false

  return {
    show: state => {
      // By reference: every edit replaces the document object, so an unchanged one is a scene
      // that has not moved — and `apply` walks every node of it.
      if (state === shown) return

      const active = engine()
      if (!active) return

      const hadCamera = shown ? firstCameraId(shown.nodes) !== null : false
      shown = state
      active.apply(state)

      // Aimed once, and only while the scene has no camera to aim itself: a model dropped
      // straight onto a montage would otherwise be drawn from wherever the free camera started.
      // Re-aimed when the scene gains or loses its camera, never on an ordinary edit — that
      // would snap the framing back on every keystroke in the inspector.
      if (firstCameraId(state.nodes) === null && (!framed || hadCamera)) {
        active.frameContents()
        framed = true
      }
    },

    draw: time => engine()?.drawFrom(shown ? firstCameraId(shown.nodes) : null, time) ?? null,

    dispose: () => {
      renderer?.dispose()
      host.remove()
    },
  }
}
