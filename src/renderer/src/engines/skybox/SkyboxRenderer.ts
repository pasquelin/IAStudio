import { Color, DirectionalLight, Raycaster, SRGBColorSpace, Vector2, type Texture } from 'three'
import type { WebGLRenderTarget } from 'three'
import {
  anglesFromDirection,
  directionFromAngles,
  type SphericalAngles,
} from '@shared/domain/angles'
import { DEFAULT_FIELD_OF_VIEW, type SkyboxContent } from '@shared/domain/skybox'
import { createGpuPipeline, type GpuPipeline } from '../gpu/GpuPipeline'
import { createAdjustPass } from '../gpu/passes/adjust'
import { createTextureCache, type TextureCache, type TextureSource } from '../scene/texture-cache'
import { createEnvironment, type ViewportEnvironment } from '../viewport/environment'
import { createTestObjects, type TestObjects } from '../viewport/test-objects'
import { turnBy } from '../viewport/look-around'
import { ViewportEngine } from '../viewport/ViewportEngine'
import { gestureFor, type SkyboxGesture } from './sun-drag'

export type SkyboxRendererOptions = {
  /** A sun dragged in the viewport. The document holds the angles; this only reports them. */
  onSunChange: (angles: SphericalAngles) => void
  loadTexture: TextureSource
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
  })

  private readonly adjust = createAdjustPass()
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

  private sourceAssetId: string | null = null
  private sourceTexture: Texture | null = null
  private quiet: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: SkyboxRendererOptions) {
    this.cache = createTextureCache(options.loadTexture)
    this.viewport.camera.position.set(0, EYE_HEIGHT, 0)
    this.viewport.scene.add(this.probes.group, this.sunLight, this.sunLight.target)
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
  }

  /** The engine holds no truth: everything it shows comes back through here. */
  apply(content: SkyboxContent): void {
    this.sun = { elevation: content.sun.elevation, azimuth: content.sun.azimuth }
    this.applySun(content)

    this.environment?.setIntensity(content.environment.intensity)
    this.environment?.setBackgroundVisible(content.environment.showBackground)

    this.adjust.setAdjustments(content.adjustments)
    this.loadSource(content.source?.assetId ?? null)
    this.regrade()
  }

  setFieldOfView(degrees: number): void {
    this.viewport.setFieldOfView(degrees)
  }

  setProbesVisible(visible: boolean): void {
    this.probes.setVisible(visible)
    this.viewport.requestRender()
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
   */
  private scheduleRefresh(): void {
    if (this.quiet !== null) clearTimeout(this.quiet)
    this.quiet = setTimeout(() => {
      this.quiet = null
      this.environment?.refresh()
    }, PMREM_QUIET_MS)
  }

  private loadSource(assetId: string | null): void {
    if (assetId === this.sourceAssetId) return

    this.releaseSource()
    this.sourceAssetId = assetId
    if (!assetId) {
      this.adjust.setSource(null)
      this.environment?.setTexture(null)
      return
    }

    void this.cache.acquire(assetId, SRGBColorSpace).then(texture => {
      // Checked on arrival: the document may have moved on to another sky while this loaded.
      if (this.sourceAssetId !== assetId) return
      this.sourceTexture = texture
      this.adjust.setSource(texture)
      this.regrade()
    })
  }

  private releaseSource(): void {
    if (this.sourceAssetId) this.cache.release(this.sourceAssetId, SRGBColorSpace)
    this.sourceAssetId = null
    this.sourceTexture = null
  }

  private applySun(content: SkyboxContent): void {
    const { x, y, z } = directionFromAngles(this.sun)
    // Placed far out along its direction: a directional light has no position of its own, but
    // three.js reads the vector from the light to its target, which sits at the origin.
    this.sunLight.position.set(x * 100, y * 100, z * 100)
    this.sunLight.intensity = content.sun.intensity
    this.sunLight.color = new Color(content.sun.color)
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
