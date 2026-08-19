import {
  EquirectangularReflectionMapping,
  PMREMGenerator,
  type Scene,
  type Texture,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/**
 * Image-based lighting for a viewport: the equirectangular picture behind the scene, and the
 * prefiltered map every physical material reads to know what it reflects.
 *
 * The two are deliberately not updated together. Showing the picture costs nothing — it is one
 * texture assignment — while prefiltering it means rendering a full mip chain, which is far too
 * expensive to run on every frame of a slider drag. So `setTexture` is instant and `refresh`
 * is called when the gesture settles; the background follows the hand, the reflections catch up.
 */
export type ViewportEnvironment = {
  /** Instant. Shows the picture; leaves the prefiltered map on the previous one. */
  setTexture: (texture: Texture | null) => void
  /** Expensive. Rebuilds the prefiltered map from the current texture — debounce the caller. */
  refresh: () => void
  /**
   * Neutral light with no picture behind it: three builds a small lit room and prefilters it,
   * so the studio ships no HDRI at all and a brand new project still shows a material under
   * usable light. A roughness judged under no light is not judged.
   */
  setStudio: () => void
  /**
   * Lights from the neutral room for the length of one pass, and puts the document's own map back
   * with `false` — what a studio VIEW needs in a quad layout, where the pane beside it is still
   * showing the scene as it is.
   *
   * The room is prefiltered once, on the first ask, and kept: a mip chain per drawn frame is what
   * this exists not to pay.
   */
  borrowStudio: (studio: boolean) => void
  setIntensity: (intensity: number) => void
  /** Radians around Y. Turns the horizon and what the scene reflects together. */
  setRotation: (radians: number) => void
  setBackgroundVisible: (visible: boolean) => void
  dispose: () => void
}

export function createEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  requestRender: () => void,
): ViewportEnvironment {
  const generator = new PMREMGenerator(renderer)
  // Compiled up front: the first `fromEquirectangular` would otherwise stall the frame that
  // asked for it, which is the frame where the user has just chosen a sky.
  generator.compileEquirectangularShader()

  let source: Texture | null = null
  let prefiltered: WebGLRenderTarget | null = null
  let backgroundVisible = true
  /** The neutral room, prefiltered on the first ask and kept — see `borrowStudio`. */
  let room: WebGLRenderTarget | null = null
  /** What the document asks for, so a borrowed pass has something to give back. */
  let owned: Texture | null = null
  let intensity = 1

  const applyBackground = (): void => {
    scene.background = backgroundVisible ? source : null
  }

  const roomMap = (): Texture => {
    if (!room) {
      const built = new RoomEnvironment()
      room = generator.fromScene(built, 0.04)
      // `fromScene` reads the room and leaves it alone: its dozen boxes and materials are ours.
      built.dispose()
    }
    return room.texture
  }

  return {
    setTexture: texture => {
      // Equirectangular unless told otherwise: it is the only shape a generator produces, and
      // a texture left on the default mapping shows as a flat plate stuck to the camera.
      if (texture) texture.mapping = EquirectangularReflectionMapping
      source = texture
      applyBackground()
      requestRender()
    },

    refresh: () => {
      const previous = prefiltered
      prefiltered = source ? generator.fromEquirectangular(source) : null
      owned = prefiltered?.texture ?? null
      scene.environment = owned
      // Disposed after the new one is in place, never before: releasing the target still bound
      // to `scene.environment` leaves every material pointing at freed GPU memory for a frame.
      previous?.dispose()
      requestRender()
    },

    setStudio: () => {
      const previous = prefiltered
      // The same room a borrowed pass uses, prefiltered once: asking the generator again here
      // would build a second copy of a map already on the GPU.
      owned = roomMap()
      prefiltered = null
      scene.environment = owned
      previous?.dispose()
      requestRender()
    },

    borrowStudio: studio => {
      scene.environment = studio ? roomMap() : owned
      // The intensity comes with it, or the mode that exists to show a mesh in an unlit scene
      // would render the Night preset's 0.15 — and with the scene's own lights out, near black.
      scene.environmentIntensity = studio ? 1 : intensity
    },

    setIntensity: wanted => {
      intensity = wanted
      scene.environmentIntensity = wanted
      scene.backgroundIntensity = wanted
      requestRender()
    },

    setRotation: radians => {
      // Both, and by the same angle: turning the picture without turning what the spheres
      // reflect makes the sun sit in one place and light from another.
      scene.backgroundRotation.y = radians
      scene.environmentRotation.y = radians
      requestRender()
    },

    setBackgroundVisible: visible => {
      backgroundVisible = visible
      applyBackground()
      requestRender()
    },

    dispose: () => {
      scene.background = null
      scene.environment = null
      prefiltered?.dispose()
      prefiltered = null
      // The room outlives every sky, so it is freed here and nowhere else.
      room?.dispose()
      room = null
      owned = null
      generator.dispose()
    },
  }
}
