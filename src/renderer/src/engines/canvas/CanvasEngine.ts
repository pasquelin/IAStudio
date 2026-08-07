import { Application, Container, Graphics, RenderTexture, Sprite, type BLEND_MODES } from 'pixi.js'
import type { BlendMode, CanvasState, Layer } from './canvas-state'

export type CanvasTool = 'brush' | 'eraser' | 'picker' | 'hand'

export type BrushSettings = {
  size: number
  /** 0 to 1. 1 is a hard edge, 0 a fully feathered one. */
  hardness: number
  opacity: number
  /** Packed RGB, the form Pixi takes. */
  color: number
}

export type CanvasEngineOptions = {
  /** Reports the colour under the pointer, so the picker can feed the swatch back. */
  onPick: (color: number) => void
  /** Fires once a stroke is finished — one history entry per gesture, not per pixel. */
  onStrokeEnd: () => void
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 24,
  hardness: 0.8,
  opacity: 1,
  color: 0x000000,
}

const BLEND_BY_MODE: Record<BlendMode, BLEND_MODES> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
}

type LayerSurface = {
  texture: RenderTexture
  sprite: Sprite
}

/**
 * The Pixi side of an image document. It owns the pixels — a GPU texture per layer — and
 * nothing else: the stack, its order, its opacities are read from the state it is handed.
 *
 * No React import (invariant 4), and no test: jsdom has no WebGL context, so what could be
 * decided has been moved to `canvas-state` and `commands`, which are fully tested.
 */
export class CanvasEngine {
  private app: Application | null = null
  private readonly world = new Container()
  private readonly surfaces = new Map<string, LayerSurface>()
  private readonly stamp = new Graphics()

  private tool: CanvasTool = 'brush'
  private brush: BrushSettings = DEFAULT_BRUSH
  private activeLayerId: string | null = null
  private size = { width: 0, height: 0 }

  private painting = false
  private last: { x: number; y: number } | null = null
  private panning = false
  /** Set before `init` resolves so a fast unmount is not left with a live renderer. */
  private disposed = false

  constructor(private readonly options: CanvasEngineOptions) {}

  /**
   * `Application.init` is asynchronous in Pixi v8 — it was not in v7. Everything after the
   * `await` must therefore check `disposed`, or a component unmounted quickly ends up with a
   * renderer bound to a canvas that no longer exists.
   */
  async mount(canvas: HTMLCanvasElement): Promise<void> {
    const app = new Application()
    await app.init({
      canvas,
      resizeTo: canvas.parentElement ?? undefined,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    })

    if (this.disposed) {
      app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true })
      return
    }

    this.app = app
    app.stage.addChild(this.world)
    app.stage.eventMode = 'static'
    app.stage.hitArea = app.screen

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  /** Reflects a state it never computes: layers appear, reorder and fade from here only. */
  apply(state: CanvasState): void {
    this.activeLayerId = state.activeLayerId
    this.size = { width: state.width, height: state.height }

    for (const layer of state.layers) this.syncLayer(layer)

    for (const [id, surface] of this.surfaces) {
      if (state.layers.some(layer => layer.id === id)) continue
      this.world.removeChild(surface.sprite)
      surface.sprite.destroy()
      // The texture lives on the GPU: dropping the reference is not enough.
      surface.texture.destroy(true)
      this.surfaces.delete(id)
    }

    // Bottom first, so the last layer of the stack is the one the eye sees on top.
    state.layers.forEach((layer, index) => {
      const surface = this.surfaces.get(layer.id)
      if (surface) this.world.setChildIndex(surface.sprite, index)
    })
  }

  setTool(tool: CanvasTool): void {
    this.tool = tool
  }

  setBrush(settings: BrushSettings): void {
    this.brush = settings
  }

  dispose(): void {
    this.disposed = true

    const canvas = this.app?.canvas
    canvas?.removeEventListener('pointerdown', this.onPointerDown)
    canvas?.removeEventListener('pointermove', this.onPointerMove)
    canvas?.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('pointerup', this.onPointerUp)

    for (const surface of this.surfaces.values()) surface.texture.destroy(true)
    this.surfaces.clear()
    this.stamp.destroy()

    this.app?.destroy({ removeView: false }, { children: true, texture: true, textureSource: true })
    this.app = null
  }

  private syncLayer(layer: Layer): void {
    let surface = this.surfaces.get(layer.id)

    if (!surface) {
      const texture = RenderTexture.create({
        width: this.size.width,
        height: this.size.height,
        resolution: 1,
      })
      const sprite = new Sprite(texture)
      surface = { texture, sprite }
      this.surfaces.set(layer.id, surface)
      this.world.addChild(sprite)
    }

    surface.sprite.visible = layer.visible
    surface.sprite.alpha = layer.opacity
    surface.sprite.blendMode = BLEND_BY_MODE[layer.blend]
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const point = this.toWorld(event)

    if (this.tool === 'picker') return this.pick(point)
    if (this.tool === 'hand' || event.button === 1) {
      this.panning = true
      this.last = { x: event.clientX, y: event.clientY }
      return
    }
    if (event.button !== 0) return

    const surface = this.activeSurface()
    if (!surface) return

    this.painting = true
    this.last = point
    this.dab(surface, point)
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.panning && this.last) {
      this.world.x += event.clientX - this.last.x
      this.world.y += event.clientY - this.last.y
      this.last = { x: event.clientX, y: event.clientY }
      return
    }

    if (!this.painting || !this.last) return
    const surface = this.activeSurface()
    if (!surface) return

    this.stroke(surface, this.last, this.toWorld(event))
    this.last = this.toWorld(event)
  }

  private readonly onPointerUp = (): void => {
    const wasPainting = this.painting
    this.painting = false
    this.panning = false
    this.last = null
    // One history entry per gesture: a command per dab would make ⌘Z useless.
    if (wasPainting) this.options.onStrokeEnd()
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 0.9 : 1.1
    this.world.scale.set(Math.min(16, Math.max(0.05, this.world.scale.x * factor)))
  }

  private activeSurface(): LayerSurface | null {
    return this.activeLayerId ? (this.surfaces.get(this.activeLayerId) ?? null) : null
  }

  private toWorld(event: PointerEvent): { x: number; y: number } {
    const canvas = this.app?.canvas
    if (!canvas) return { x: 0, y: 0 }

    const bounds = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left - this.world.x) / this.world.scale.x,
      y: (event.clientY - bounds.top - this.world.y) / this.world.scale.y,
    }
  }

  /**
   * A fast drag delivers a handful of `pointermove` for a long distance; drawing only at those
   * points leaves a dotted line. One dab every quarter-radius closes it.
   */
  private stroke(
    surface: LayerSurface,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const step = Math.max(1, this.brush.size / 4)
    const count = Math.ceil(distance / step)

    for (let index = 1; index <= count; index += 1) {
      const ratio = index / count
      this.dab(surface, {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      })
    }
  }

  private dab(surface: LayerSurface, point: { x: number; y: number }): void {
    const renderer = this.app?.renderer
    if (!renderer) return

    const erasing = this.tool === 'eraser'
    this.stamp.clear()
    this.stamp.circle(point.x, point.y, this.brush.size / 2)
    this.stamp.fill({ color: erasing ? 0xffffff : this.brush.color, alpha: this.brush.opacity })
    // Erasing is the same stroke in `erase` blend: on a transparent layer, painting white
    // would just paint white.
    this.stamp.blendMode = erasing ? 'erase' : 'normal'

    // `clear: false`, or every dab would wipe the stroke that came before it. And `target`,
    // not the `renderTexture` option, which v8 deprecated.
    renderer.render({ container: this.stamp, target: surface.texture, clear: false })
  }

  private pick(point: { x: number; y: number }): void {
    const renderer = this.app?.renderer
    const surface = this.activeSurface()
    if (!renderer || !surface) return

    const pixels = renderer.extract.pixels({ target: surface.sprite })
    const x = Math.floor(point.x)
    const y = Math.floor(point.y)
    if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) return

    const offset = (y * pixels.width + x) * 4
    const red = pixels.pixels[offset] ?? 0
    const green = pixels.pixels[offset + 1] ?? 0
    const blue = pixels.pixels[offset + 2] ?? 0
    this.options.onPick((red << 16) | (green << 8) | blue)
  }
}
