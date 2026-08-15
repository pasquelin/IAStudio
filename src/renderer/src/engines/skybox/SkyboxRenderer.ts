import { DirectionalLight, Raycaster, SRGBColorSpace, Vector2, type Texture } from 'three'
import type { WebGLRenderTarget } from 'three'
import {
  anglesFromDirection,
  directionFromAngles,
  type SphericalAngles,
} from '@shared/domain/angles'
import { DEFAULT_FIELD_OF_VIEW, type SkyboxContent, type SkyboxView } from '@shared/domain/skybox'
import { createGpuPipeline, type GpuPipeline } from '../gpu/GpuPipeline'
import { createAdjustPass } from '../gpu/passes/adjust'
import { reportFailure } from '@/services/diagnostics'
import { createTextureBinding, type TextureBinding } from '../scene/texture-binding'
import { createTextureCache, type TextureCache, type TextureSource } from '../scene/texture-cache'
import { createEnvironment, type ViewportEnvironment } from '../viewport/environment'
import { createTestObjects, type TestObjects } from '../viewport/test-objects'
import { turnBy } from '../viewport/look-around'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { createProjectionPass, type ProjectionPass } from './projection-shader'
import { gestureFor, type SkyboxGesture } from './sun-drag'

export type SkyboxRendererOptions = {
  /** A sun dragged in the viewport. The document holds the angles; this only reports them. */
  onSunChange: (angles: SphericalAngles) => void
  loadTexture: TextureSource
  /**
   * When each asset was last written, read off the catalogue by whoever mounts the engine — the
   * same port `SceneRenderer` takes, and for the same reason: a picture edited and saved keeps
   * its id, so nothing here would ever ask for it again. See `refreshSource`.
   */
  assetVersion?: (assetId: string) => string | undefined
}

/**
 * Milliseconds of quiet before the prefiltered environment is rebuilt. The background follows
 * a slider at frame rate because it is one shader; prefiltering is a full mip chain, and doing
 * it per frame of a drag drops the viewport to single digits.
 */
const PMREM_QUIET_MS = 120

/** Eye height, so the ground plane reads as a floor rather than as a wall through the camera. */
const EYE_HEIGHT = 1.6

/** How far in front the probes float — clear of the camera, close enough to read. */
const PROBE_DISTANCE = 5

/** Working resolution of the graded picture. Export re-renders at full size; this is for looking. */
const PREVIEW_WIDTH = 2048
const PREVIEW_HEIGHT = 1024

/**
 * A skybox, seen from the inside. The environment is the subject here, not the decor: the
 * camera stands at the centre and the spheres are probes for judging what the sky lights.
 *
 * Nothing it shows is ever written to a file. The source texture goes through one grading pass
 * into a render target, the target feeds both the background and the prefiltered map, and the
 * adjustments stay uniforms all the way to export.
 */
export class SkyboxRenderer {
  private readonly viewport = new ViewportEngine({
    toneMapping: true,
    controls: 'none',
    fieldOfView: DEFAULT_FIELD_OF_VIEW,
    // Drawn over the scene rather than instead of it: `onOverlay` is the one hook that runs with
    // `autoClear` off, and a flat projection is a quad that covers everything behind it anyway.
    onOverlay: () => this.drawProjection(),
  })

  private readonly adjust = createAdjustPass()
  private readonly projection: ProjectionPass = createProjectionPass()
  private readonly probes: TestObjects = createTestObjects({ probeDistance: PROBE_DISTANCE })
  private readonly sunLight = new DirectionalLight(0xffffff, 1)
  private readonly cache: TextureCache
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()

  private pipeline: GpuPipeline | null = null
  private environment: ViewportEnvironment | null = null
  private graded: WebGLRenderTarget | null = null

  private look: SphericalAngles = { elevation: 0, azimuth: 0 }
  private sun: SphericalAngles = { elevation: Math.PI / 6, azimuth: 0 }
  private gesture: SkyboxGesture | null = null
  private lastPointer: { x: number; y: number } | null = null

  /** What the setting asks for; what is shown is this AND a sky to judge — see `syncProbes`. */
  private probesWanted = true
  private view: SkyboxView = 'immersive'
  /** What the document asks of the backdrop. A flat view turns it off without forgetting it. */
  private backgroundWanted = true
  private sourceAssetId: string | null = null
  private sourceTexture: Texture | null = null
  /** The one reference this engine holds on a picture, and what settles its races. */
  private readonly source: TextureBinding
  private quiet: ReturnType<typeof setTimeout> | null = null

  /**
   * What the last `apply` was given. Held by reference rather than copied: an edit replaces the
   * section it touches instead of writing into it (`skybox/commands.ts:31`), so a section that
   * did not move is still the same object — asserted where it is produced, in `commands.test.ts`.
   *
   * Cleared by `mount`, so a renderer that received a document before it had a renderer applies
   * it whole rather than recognising it and doing nothing.
   */
  private applied: SkyboxContent | null = null

  constructor(private readonly options: SkyboxRendererOptions) {
    this.cache = createTextureCache(
      options.loadTexture,
      (assetId, error) => reportFailure('skybox.source', assetId, error),
      options.assetVersion,
    )
    // The reference, the race and the version are all the binding's: written here too, the sky
    // would be the third copy of a rule the studio already keeps in one place.
    this.source = createTextureBinding(this.cache, SRGBColorSpace, texture => {
      this.sourceTexture = texture
      this.adjust.setSource(texture)
      this.regrade()
    })
    this.viewport.camera.position.set(0, EYE_HEIGHT, 0)
    this.viewport.scene.add(this.probes.group, this.sunLight, this.sunLight.target)
    // Hidden until a sky arrives, and before the first frame rather than after it: `apply` is
    // what reveals them, and a viewport mounted before it would flash the ground for a frame.
    this.probes.setVisible(false)
  }

  mount(host: HTMLElement): void {
    this.viewport.mount(host)

    const renderer = this.viewport.gl
    const canvas = this.viewport.canvas
    if (!renderer || !canvas) return

    this.pipeline = createGpuPipeline(renderer)
    this.environment = createEnvironment(renderer, this.viewport.scene, this.viewport.requestRender)
    // Half-float, not bytes: this target is what the prefiltered map is built from, and eight
    // bits per channel banding shows on a sky gradient long before it shows on a texture.
    this.graded = this.pipeline.createTarget(PREVIEW_WIDTH, PREVIEW_HEIGHT, 'float')

    canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)

    this.aimCamera()

    // A document applied before the viewport had a renderer reached none of the above. Forgetting
    // what was applied is what makes it land now — `CanvasEngine.mount` carries the same story,
    // and it is the difference between a sky that opens lit and one that opens on its defaults.
    const held = this.applied
    if (held) {
      this.applied = null
      this.apply(held)
    }
  }

  /**
   * The engine holds no truth: everything it shows comes back through here.
   *
   * Each section is skipped when it is the object already applied, as `SceneRenderer.syncNode`
   * skips a node and `CanvasEngine.apply` skips a tree: an edit replaces the one section it
   * touches (`skybox/commands.ts:31`), so the other three come back identical. Unguarded, one
   * frame of the sun's colour re-graded the picture into the 2048×1024 float target.
   */
  apply(content: SkyboxContent): void {
    const previous = this.applied
    this.applied = content

    if (previous?.sun !== content.sun) {
      this.sun = { elevation: content.sun.elevation, azimuth: content.sun.azimuth }
      this.applySun(content)
    }

    const environmentMoved = previous?.environment !== content.environment
    if (environmentMoved) {
      this.environment?.setIntensity(content.environment.intensity)
      this.backgroundWanted = content.environment.showBackground
    }

    const graded = previous?.adjustments !== content.adjustments
    if (graded) this.adjust.setAdjustments(content.adjustments)

    // Before `syncView`, which reads the sky through `syncProbes`, and before `regrade`, which
    // would otherwise grade the picture this call is about to release.
    const skyMoved = this.loadSource(content.source?.assetId ?? null)

    if (environmentMoved || skyMoved) this.syncView()

    if (graded) this.regrade()
  }

  setFieldOfView(degrees: number): void {
    this.viewport.setFieldOfView(degrees)
  }

  /**
   * Which of the four ways of looking at the sky is on screen. The three flat ones are one shader
   * over the frame — see `projection-shader` — so nothing about the scene changes but what is
   * worth drawing behind them.
   */
  setView(view: SkyboxView): void {
    if (view === this.view) return
    this.view = view
    this.syncView()
  }

  setProbesVisible(visible: boolean): void {
    this.probesWanted = visible
    this.syncProbes()
  }

  /**
   * Shown when the setting asks for them AND there is a sky to judge.
   *
   * Nothing to judge is only half the reason. The other half is that the empty state is the one
   * sentence telling anyone what to do in this space, and it sits over the viewport: a
   * `text-muted` over a lit ground and three spheres does not read at all.
   */
  private syncProbes(): void {
    // Nothing to judge behind a flat projection either: the quad covers them whole.
    const immersive = this.view === 'immersive'
    this.probes.setVisible(immersive && this.probesWanted && this.sourceAssetId !== null)
  }

  /**
   * What the scene is worth drawing under the current view, and what the projection draws over it.
   *
   * The backdrop goes with the flat views on purpose: the quad letterboxes its picture, and the
   * immersive sky showing through the bars would read as part of what is being judged.
   */
  private syncView(): void {
    const immersive = this.view === 'immersive'
    this.syncProbes()
    this.environment?.setBackgroundVisible(immersive && this.backgroundWanted)
    // `immersive` is not a layout: the guard above is what makes the narrowing safe here.
    if (this.view !== 'immersive') this.projection.setLayout(this.view)
    this.viewport.requestRender()
  }

  /** The flat views, drawn after the scene. The immersive one is the scene. */
  private drawProjection(): void {
    if (this.view === 'immersive' || !this.pipeline || !this.graded) return

    const canvas = this.viewport.canvas
    this.projection.setFrame(canvas?.clientWidth ?? 0, canvas?.clientHeight ?? 0)
    this.projection.setSource(this.graded.texture)
    this.pipeline.renderToScreen(this.projection.material)
  }

  setGroundVisible(visible: boolean): void {
    this.probes.setGroundVisible(visible)
    this.viewport.requestRender()
  }

  dispose(): void {
    if (this.quiet !== null) clearTimeout(this.quiet)
    this.quiet = null

    const canvas = this.viewport.canvas
    canvas?.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)

    this.releaseSource()
    this.cache.dispose()
    this.environment?.dispose()
    this.graded?.dispose()
    this.pipeline?.dispose()
    this.adjust.dispose()
    this.projection.dispose()
    this.probes.dispose()
    this.viewport.dispose()
  }

  /** Runs the grading pass and hands its result to the background — the cheap half. */
  private regrade(): void {
    const pipeline = this.pipeline
    const graded = this.graded
    if (!pipeline || !graded || !this.sourceTexture) return

    pipeline.renderTo(this.adjust.material, graded)
    this.environment?.setTexture(graded.texture)
    this.scheduleRefresh()
  }

  /**
   * The expensive half, once the gesture settles. Rescheduled on every change rather than
   * queued, so a drag of two hundred frames costs one prefilter instead of two hundred.
   *
   * Only work that changes the PICTURE reschedules it, which is why `apply` reaches this through
   * `regrade` alone. A sun drag is a light moving, not a picture changing: it has no prefilter of
   * its own to delay, and postponing the one an exposure edit already owed would leave the probes
   * lit by a stale map for as long as the hand keeps moving.
   */
  private scheduleRefresh(): void {
    if (this.quiet !== null) clearTimeout(this.quiet)
    this.quiet = setTimeout(() => {
      this.quiet = null
      this.environment?.refresh()
    }, PMREM_QUIET_MS)
  }

  /** Whether the sky moved. The fact is decided here, so `apply` reads it rather than guessing. */
  private loadSource(assetId: string | null): boolean {
    if (assetId === this.sourceAssetId) return false

    this.sourceAssetId = assetId
    // Before the binding, not after: it installs `null` on the spot, and the environment has to
    // let go of a texture that is about to be freed.
    if (!assetId) this.environment?.setTexture(null)
    this.source(assetId)

    return true
  }

  /**
   * The picture behind the sky, asked for again when the catalogue says it was rewritten.
   *
   * Costs nothing when nothing moved — the binding compares what it holds before letting go — so
   * this may be called on every read of the shelf, which is what the document does with it.
   */
  refreshSource(): void {
    this.source(this.sourceAssetId)
  }

  private releaseSource(): void {
    this.source(null)
    this.sourceAssetId = null
    this.sourceTexture = null
  }

  private applySun(content: SkyboxContent): void {
    const { x, y, z } = directionFromAngles(this.sun)
    // Placed far out along its direction: a directional light has no position of its own, but
    // three.js reads the vector from the light to its target, which sits at the origin.
    this.sunLight.position.set(x * 100, y * 100, z * 100)
    this.sunLight.intensity = content.sun.intensity
    // `.set`, not a new Color: this runs on every frame of every drag, and three owns the instance.
    this.sunLight.color.set(content.sun.color)
    this.viewport.requestRender()
  }

  private aimCamera(): void {
    const { x, y, z } = directionFromAngles(this.look)
    const camera = this.viewport.camera
    camera.lookAt(camera.position.x + x, camera.position.y + y, camera.position.z + z)
    this.viewport.requestRender()
  }

  /** The direction the pointer is looking at. At the centre, that is the ray itself. */
  private rayDirection(event: PointerEvent): { x: number; y: number; z: number } | null {
    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return null

    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, this.viewport.camera)
    const { x, y, z } = this.raycaster.ray.direction
    return { x, y, z }
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return

    const direction = this.rayDirection(event)
    if (!direction) return

    this.gesture = gestureFor(direction, this.sun)
    this.lastPointer = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.gesture || !this.lastPointer) return

    if (this.gesture === 'sun') {
      const direction = this.rayDirection(event)
      if (!direction) return
      // The angles are the truth and the light follows them, never the other way round: a
      // position held as truth makes the panel and the viewport disagree across the zenith.
      this.options.onSunChange(anglesFromDirection(direction, this.sun))
      return
    }

    const deltaX = event.clientX - this.lastPointer.x
    const deltaY = event.clientY - this.lastPointer.y
    this.lastPointer = { x: event.clientX, y: event.clientY }
    this.look = turnBy(this.look, deltaX, deltaY)
    this.aimCamera()
  }

  private readonly onPointerUp = (): void => {
    this.gesture = null
    this.lastPointer = null
  }
}
