import {
  Color,
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
import { previewGeometry } from './preview-geometry'
import { slotFor, type MaterialSlot, type PreviewShape, type TextureState } from './texture-state'

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
   * Per slot, the asset this material holds a reference on, with the colour space it was taken
   * in: the cache counts references per pair, and giving one back under the other space would
   * leave the texture alive for the rest of the session.
   */
  private readonly holding = new Map<MaterialSlot, { assetId: string; space: ColorSpace }>()
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
    for (const slot of this.holding.keys()) this.release(slot)
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

  private applyMaterial({ material }: TextureState): void {
    this.material.color.set(material.color)
    this.material.roughness = material.roughness
    this.material.metalness = material.metalness
    this.material.normalScale.set(
      material.normalScale,
      // OpenGL and DirectX disagree on which way the green channel points, and a normal map
      // baked for the other one lights from the wrong side until this is flipped.
      material.invertNormalGreen ? -material.normalScale : material.normalScale,
    )
    this.material.displacementScale = material.heightScale
    this.material.aoMapIntensity = material.aoIntensity
    this.material.emissive = new Color(material.emissive)
    this.material.emissiveIntensity = material.emissiveIntensity

    this.applyTransform(material)
    this.material.needsUpdate = true
  }

  /**
   * Repeat, offset and rotation are applied to **every** map, not just the base colour: applied
   * to one alone, the maps drift apart and the relief stops matching the picture it lifts.
   */
  private applyTransform({ tiling, offset, rotation }: TextureState['material']): void {
    for (const slot of this.holding.keys()) {
      const map = this.material[slot]
      if (!map) continue

      map.wrapS = RepeatWrapping
      map.wrapT = RepeatWrapping
      map.repeat.set(tiling.x, tiling.y)
      map.offset.set(offset.x, offset.y)
      map.center.set(0.5, 0.5)
      map.rotation = rotation
      map.needsUpdate = true
    }
  }

  private applyChannels(texture: TextureState): void {
    for (const channel of PBR_CHANNELS) {
      const slot = slotFor(channel)
      if (!slot) continue

      const wanted = texture.channels[channel]?.assetId ?? null
      if ((this.holding.get(slot)?.assetId ?? null) === wanted) continue

      this.release(slot)
      if (!wanted) continue

      const space = spaceOf(channel)
      this.holding.set(slot, { assetId: wanted, space })
      void this.cache.acquire(wanted, space).then(loaded => {
        // Stale: the slot has moved on, and the reference it took went back with the move.
        if (this.holding.get(slot)?.assetId !== wanted || !loaded) return
        this.install(slot, loaded, texture)
      })
    }
  }

  private install(slot: MaterialSlot, map: Texture, texture: TextureState): void {
    this.material[slot] = map
    // A slot going from empty to filled changes the shader program itself.
    this.material.needsUpdate = true
    this.applyTransform(texture.material)
    this.viewport.requestRender()
  }

  private release(slot: MaterialSlot): void {
    const held = this.holding.get(slot)
    if (held) this.cache.release(held.assetId, held.space)
    this.holding.delete(slot)

    if (this.material[slot] === null) return
    this.material[slot] = null
    this.material.needsUpdate = true
  }

  private async applyEnvironment({ preview }: TextureState): Promise<void> {
    const environment = this.environment
    if (!environment) return

    environment.setIntensity(preview.envIntensity)
    environment.setRotation(preview.envRotation)
    environment.setBackgroundVisible(preview.showBackground)
    this.spinning = preview.autoSpin
    if (preview.autoSpin) this.viewport.resetClock()

    await this.sky.apply(environment, preview.environment)
  }

  /** The backdrop, unless a sky is hanging behind the subject — in which case the sky is it. */
  private paintBackground(): void {
    if (this.sky.showsSky()) return
    this.viewport.setBackgroundColor(this.viewport.paletteToken('--color-viewport'))
  }
}

/**
 * The base colour is authored in sRGB; every other map carries data, not colour, and decoding
 * one would wash out the normals and lighten the roughness.
 */
function spaceOf(channel: PbrChannel): ColorSpace {
  return channel === 'baseColor' ? SRGBColorSpace : NoColorSpace
}
