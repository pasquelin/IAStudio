import {
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type ColorSpace,
  type Texture,
} from 'three'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { reportFailure } from '@/services/diagnostics'
import { createTextureCache, type TextureCache, type TextureSource } from '../scene/texture-cache'
import { createSkyBinding, type SkyBinding } from '../viewport/sky-binding'
import { createEnvironment, type ViewportEnvironment } from '../viewport/environment'
import { ViewportEngine } from '../viewport/ViewportEngine'
import {
  bindUniforms,
  createUniforms,
  EDGE_DEFINE,
  materialFrameOf,
  patchFragment,
  syncEdgeTransform,
} from './material-shader'
import { previewGeometry } from './preview-geometry'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/texture'
import {
  contentOf,
  DEFAULT_PREVIEW,
  slotFor,
  type PreviewShape,
  type TextureState,
} from './texture-state'

export type TextureRendererOptions = {
  /** Injected: jsdom decodes no image, and the engine is built the same way in both. */
  loadTexture: TextureSource
}

/** Radians per second of auto spin — slow enough to read a normal map, fast enough to see. */
const SPIN_RATE = 0.35

/**
 * A texture on a shape, under light. The subject is the material, so the viewport orbits it and
 * the environment is what makes it legible: a roughness judged under a flat lamp is not judged.
 *
 * It holds no truth of its own. Everything it shows comes back through `apply`, which is what
 * lets a document be reopened six months later and look the same.
 */
export class TextureRenderer {
  private readonly viewport = new ViewportEngine({
    toneMapping: true,
    onFrame: delta => this.spin(delta),
  })

  private readonly material = new MeshStandardMaterial()
  private readonly mesh = new Mesh(previewGeometry('sphere', false), this.material)
  private readonly cache: TextureCache

  private environment: ViewportEnvironment | null = null

  /**
   * Per channel, the asset this material holds a reference on. Keyed by channel rather than by
   * slot because the cavity mask has no slot at all, and the colour space is a function of the
   * channel — held as a second field it was free to disagree with `spaceOf` and leave a texture
   * alive for the rest of the session.
   */
  private readonly holding = new Map<PbrChannel, string>()
  private readonly uniforms = createUniforms()
  /** What the maps are currently placed on, so a map arriving late is placed on the same thing. */
  private transform: MapTransform = DEFAULT_TRANSFORM
  /** Anchors already reported, so a rebuilt program does not say the same thing again. */
  private readonly reported = new Set<string>()
  private shape: PreviewShape = 'sphere'
  private displaced = false
  private spinning = false
  private readonly sky: SkyBinding

  constructor(options: TextureRendererOptions) {
    this.cache = createTextureCache(options.loadTexture, (assetId, error) =>
      reportFailure('texture.map', assetId, error),
    )
    this.sky = createSkyBinding(this.cache, () => this.paintBackground())
    this.viewport.camera.position.set(0, 0.6, 3.2)
    this.viewport.scene.add(this.mesh)

    // Bound once on the material, not per compile: three hands the hook a fresh uniform object
    // each time the program is rebuilt, and the engine's values have to survive that.
    this.material.onBeforeCompile = shader => {
      const { source, missing } = patchFragment(shader.fragmentShader)
      shader.fragmentShader = source
      bindUniforms(shader.uniforms, this.uniforms)

      // Once per anchor per engine, and the `Set` is what makes that true: a program is rebuilt
      // whenever a channel is filled, and a repeated report would bury the journal. A remap that
      // quietly stopped applying is a slider that looks alive and does nothing.
      for (const anchor of missing) {
        if (this.reported.has(anchor)) continue
        this.reported.add(anchor)
        reportFailure('texture.shader', anchor, new Error(`three no longer ships ${anchor}`))
      }
    }
  }

  mount(host: HTMLElement): void {
    this.viewport.mount(host)

    const renderer = this.viewport.gl
    if (!renderer) return

    this.environment = createEnvironment(renderer, this.viewport.scene, this.viewport.requestRender)
    this.environment.setStudio()
    // The studio preset has no picture behind it, so the backdrop is the viewport's own colour.
    this.paintBackground()
  }

  /** The engine holds no truth: everything it shows comes back through here. */
  apply(texture: TextureState): void {
    this.applyGeometry(texture)
    this.applyMaterial(texture)
    this.applyChannels(texture)
    void this.applyEnvironment(texture)
    this.viewport.requestRender()
  }

  dispose(): void {
    for (const channel of this.holding.keys()) this.release(channel)
    this.holding.clear()
    this.sky.release()
    this.cache.dispose()

    this.mesh.geometry.dispose()
    this.material.dispose()
    this.environment?.dispose()
    this.viewport.dispose()
  }

  private spin(delta: number): boolean {
    if (!this.spinning) return false
    this.mesh.rotation.y += SPIN_RATE * delta
    return true
  }

  private applyGeometry({ preview, material }: TextureState): void {
    const displaced = material.heightScale > 0
    if (preview.shape === this.shape && displaced === this.displaced) return

    this.shape = preview.shape
    this.displaced = displaced

    const geometry: BufferGeometry = previewGeometry(preview.shape, displaced)
    // Replaced rather than mutated, and the old one freed here: a geometry left behind holds its
    // buffers on the GPU until the context goes.
    this.mesh.geometry.dispose()
    this.mesh.geometry = geometry
  }

  private applyMaterial(texture: TextureState): void {
    const { material } = texture
    this.material.color.set(material.color)
    this.material.roughness = material.roughness
    this.material.metalness = material.metalness

    const frame = materialFrameOf(texture)
    this.uniforms.roughnessRemap.value.set(frame.roughnessRemap.x, frame.roughnessRemap.y)
    this.uniforms.metalnessRemap.value.set(frame.metalnessRemap.x, frame.metalnessRemap.y)
    this.uniforms.edgeIntensity.value = frame.edgeIntensity
    this.material.normalScale.set(
      material.normalScale,
      // OpenGL and DirectX disagree on which way the green channel points, and a normal map
      // baked for the other one lights from the wrong side until this is flipped.
      material.invertNormalGreen ? -material.normalScale : material.normalScale,
    )
    this.material.displacementScale = material.heightScale
    this.material.aoMapIntensity = material.aoIntensity
    // `.set`, not a new Color: this runs on every frame of every drag, and three owns the instance.
    this.material.emissive.set(material.emissive)
    this.material.emissiveIntensity = material.emissiveIntensity

    // No `needsUpdate` here: nothing above affects the PROGRAM. A slot going empty→filled does,
    // and `install`, `release` and `setEdgeMap` are the three that say so.
    this.applyTransform(texture)
  }

  /**
   * Repeat, offset and rotation are applied to **every** map, not just the base colour: applied
   * to one alone, the maps drift apart and the relief stops matching the picture it lifts.
   *
   * Guarded on the values having moved, as `applyGeometry` is: `apply` runs on every frame of
   * every drag, and twelve of the fifteen settings have nothing to do with tiling.
   *
   * And no `needsUpdate` on a map, ever. It bumps `source.needsUpdate` too, which re-uploads the
   * pixels AND rebuilds the mip chain — eight 2K channels is 128 MB of upload per frame. Nothing
   * here needs it: `matrixAutoUpdate` is on, so three refreshes the uv matrix itself every frame,
   * and `wrapS`/`wrapT`, which really are upload-time state, are set once in `install`.
   */
  private applyTransform({ material, preview }: TextureState): void {
    const seamShift = seamShiftOf(preview)
    // Compared before anything is built, not after: this used to allocate two objects to answer
    // a question that is nearly always no — twelve of the fifteen settings above have nothing to
    // do with tiling, and each of them arrives on every frame of its own drag.
    if (samePlacement(this.transform, material, preview.tilingPreview, seamShift)) return

    const { tiling, offset, rotation } = material
    this.transform = { tiling, offset, rotation, tilingPreview: preview.tilingPreview, seamShift }

    for (const map of this.maps()) this.placeMap(map)
    syncEdgeTransform(this.uniforms)
  }

  /** Every texture this material shows, the cavity mask included — it is not in a slot. */
  private *maps(): Generator<Texture> {
    for (const channel of this.holding.keys()) {
      const slot = slotFor(channel)
      const map = slot ? this.material[slot] : this.uniforms.edgeMap.value
      if (map) yield map
    }
  }

  private applyChannels(texture: TextureState): void {
    for (const channel of PBR_CHANNELS) {
      const wanted = texture.channels[channel]?.assetId ?? null
      if ((this.holding.get(channel) ?? null) === wanted) continue

      this.release(channel)
      if (!wanted) continue

      this.holding.set(channel, wanted)
      void this.cache.acquire(wanted, spaceOf(channel)).then(loaded => {
        // Stale: the channel has moved on, and the reference it took went back with the move.
        if (this.holding.get(channel) !== wanted || !loaded) return
        this.install(channel, loaded)
      })
    }
  }

  /**
   * Takes no state: decoding a 4K picture runs for hundreds of milliseconds, and the state that
   * started the load is stale by the time it resolves — reapplying it snapped every other map back
   * to the tiling the user had already left.
   */
  private install(channel: PbrChannel, map: Texture): void {
    // Upload-time state, set before the first render rather than on every frame: changing either
    // of these later would cost a full re-upload of the pixels.
    map.wrapS = RepeatWrapping
    map.wrapT = RepeatWrapping
    map.center.set(0.5, 0.5)
    this.placeMap(map)

    const slot = slotFor(channel)
    if (slot) this.material[slot] = map
    else this.setEdgeMap(map)

    // A channel going from empty to filled changes the shader program itself.
    this.material.needsUpdate = true
    syncEdgeTransform(this.uniforms)
    this.viewport.requestRender()
  }

  /** The transform this material is on, onto one map — the new one, or all of them. */
  private placeMap(map: Texture): void {
    const { tiling, offset, rotation, tilingPreview, seamShift } = this.transform
    // Multiplied, not replaced: the preview asks "how does this look repeated", and the answer
    // has to be the material's own repeat seen more times, not somebody else's repeat.
    map.repeat.set(tiling.x * tilingPreview, tiling.y * tilingPreview)
    map.offset.set(offset.x + seamShift, offset.y + seamShift)
    map.rotation = rotation
  }

  private release(channel: PbrChannel): void {
    const held = this.holding.get(channel)
    if (held) this.cache.release(held, spaceOf(channel))
    this.holding.delete(channel)

    const slot = slotFor(channel)
    if (!slot) {
      this.setEdgeMap(null)
      return
    }

    if (this.material[slot] === null) return
    this.material[slot] = null
    this.material.needsUpdate = true
  }

  /**
   * The define, not just the uniform: an unbound sampler is undefined behaviour on some drivers,
   * so the cavity code has to be absent from the program rather than merely inert.
   */
  private setEdgeMap(map: Texture | null): void {
    if (this.uniforms.edgeMap.value === map) return
    this.uniforms.edgeMap.value = map

    const defines = this.material.defines ?? {}
    if (map) {
      defines[EDGE_DEFINE] = ''
      // `vUv` exists only where something asks for it, and no slot asks on this mask's behalf.
      defines.USE_UV = ''
    } else {
      delete defines[EDGE_DEFINE]
      delete defines.USE_UV
    }

    this.material.defines = defines
    this.material.needsUpdate = true
  }

  private async applyEnvironment({ preview }: TextureState): Promise<void> {
    const environment = this.environment
    if (!environment) return

    environment.setIntensity(preview.envIntensity)
    environment.setRotation(preview.envRotation)
    environment.setBackgroundVisible(preview.showBackground)
    // On the edge only: `apply` runs on every value a drag emits, and restarting the clock there
    // leaves the spin the time since the last slider value instead of since the last frame.
    if (preview.autoSpin && !this.spinning) this.viewport.resetClock()
    this.spinning = preview.autoSpin

    await this.sky.apply(environment, preview.environment)
  }

  /** The backdrop, unless a sky is hanging behind the subject — in which case the sky is it. */
  private paintBackground(): void {
    if (this.sky.showsSky()) return
    this.viewport.setBackgroundColor(this.viewport.paletteToken('--color-viewport'))
  }
}

/**
 * A colour channel is authored in sRGB and has to be decoded; a data channel must not be, or the
 * normals wash out and the roughness lightens.
 *
 * Which is which comes from the domain rather than from a test on the id here: it was
 * `channel === 'baseColor'`, and `emissive` — a colour map, read as one by three — fell on the
 * wrong side and came out dark and desaturated.
 */
function spaceOf(channel: PbrChannel): ColorSpace {
  return contentOf(channel) === 'color' ? SRGBColorSpace : NoColorSpace
}

/**
 * How every map is laid on the shape: what the material decided, and what the view adds on top.
 * The two are kept apart right up to `placeMap` — a preview that wrote into the material would
 * send a texture out into a scene tiled four times over, and offset by half.
 */
type MapTransform = Pick<TextureState['material'], 'tiling' | 'offset' | 'rotation'> & PreviewFrame

/** What the view adds, on top of what the material decided. */
type PreviewFrame = { tilingPreview: number; seamShift: number }

const SEAM_SHIFT = 0.5

/** Half a width and half a height is exactly what brings a wrap edge to the middle. */
function seamShiftOf({ showSeam }: TextureState['preview']): number {
  return showSeam ? SEAM_SHIFT : 0
}

/** Where every map starts, so one arriving before the first `apply` is still placed on something. */
const DEFAULT_TRANSFORM: MapTransform = {
  ...DEFAULT_TEXTURE_MATERIAL,
  tilingPreview: DEFAULT_PREVIEW.tilingPreview,
  seamShift: seamShiftOf(DEFAULT_PREVIEW),
}

function samePlacement(
  current: MapTransform,
  material: TextureState['material'],
  tilingPreview: number,
  seamShift: number,
): boolean {
  return (
    current.rotation === material.rotation &&
    current.tiling.x === material.tiling.x &&
    current.tiling.y === material.tiling.y &&
    current.offset.x === material.offset.x &&
    current.offset.y === material.offset.y &&
    current.tilingPreview === tilingPreview &&
    current.seamShift === seamShift
  )
}
