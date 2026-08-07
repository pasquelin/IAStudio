// First, and before any other Pixi import: Electron's CSP forbids `unsafe-eval`, and Pixi builds
// its shaders with `new Function()`, so `Application.init` rejects inside a promise and the canvas
// stays blank with a clean console. Despite the name, this ships static polyfills instead.
import 'pixi.js/unsafe-eval'
import {
  Application,
  Container,
  Graphics,
  Rectangle,
  RenderTexture,
  Sprite,
  type BLEND_MODES,
} from 'pixi.js'
import { onPaletteChange, tokenAsHex } from '../core/palette'
import type { BlendMode, CanvasState, Layer } from './canvas-state'
import type { Point } from './shape-geometry'

export type CanvasTool =
  | 'select'
  | 'move'
  | 'crop'
  | 'shape'
  | 'brush'
  | 'text'
  | 'comment'
  | 'eraser'
  | 'fill'
  | 'picker'
  | 'hand'

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

/**
 * Declared by the bar, not implemented here. Kept in the union so the registry stays typed, and
 * kept in one place so wiring one is a single deletion.
 */
const UNBUILT_TOOLS: ReadonlySet<CanvasTool> = new Set<CanvasTool>([
  'crop',
  'shape',
  'text',
  'comment',
])

/**
 * Pixi's own name for each mode. Partial: `hue` has no Pixi equivalent and waits for a filter of
 * its own, so it falls back to `normal` rather than compositing as something it is not.
 */
const BLEND_BY_MODE: Partial<Record<BlendMode, BLEND_MODES>> = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
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

  private readonly marquee = new Graphics()
  private painting = false
  private last: Point | null = null
  private panning = false
  private moving = false
  private selecting: { x: number; y: number; width: number; height: number } | null = null
  /** Read off the canvas in `mount`, so the overlay follows the studio palette. */
  private overlayColor = 0xffffff
  private stopPaletteWatch: (() => void) | null = null
  /** Set before `init` resolves so a fast unmount is not left with a live renderer. */
  private disposed = false
  /** Last state handed over, replayed once the renderer exists. */
  private pending: CanvasState | null = null

  constructor(private readonly options: CanvasEngineOptions) {}

  /**
   * `Application.init` is asynchronous in Pixi v8 — it was not in v7. Everything after the
   * `await` must therefore check `disposed`, or a component unmounted quickly ends up with a
   * renderer bound to a canvas that no longer exists.
   */
  async mount(host: HTMLElement): Promise<void> {
    const app = new Application()
    // Pixi makes its own canvas, which is then appended: sharing one element across mounts is
    // what breaks under React's double-invoked effects in development. The first instance's
    // `init` resolves after the second has already claimed the element, sees `disposed`, and
    // tears down the context the second one is drawing into — leaving a canvas dead for good.
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio,
    })

    if (this.disposed) {
      app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
      return
    }

    const canvas = app.canvas
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    host.appendChild(canvas)

    this.app = app
    app.stage.addChild(this.world)
    // Above the layers, inside the world: the marquee has to follow pan and zoom with them.
    this.world.addChild(this.marquee)

    this.applyPalette(canvas)
    this.stopPaletteWatch = onPaletteChange(() => this.applyPalette(canvas))

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })

    // React pushed the state while `init` was still in flight, so the surfaces were built
    // without a renderer to back them. Replaying it here is what makes the first stroke land —
    // nothing else would call `apply` again until the stack changes.
    if (this.pending) this.apply(this.pending)
  }

  /** Reflects a state it never computes: layers appear, reorder and fade from here only. */
  apply(state: CanvasState): void {
    this.pending = state
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

    // Restacking the layers would otherwise bury the marquee under them.
    if (this.marquee.parent === this.world) {
      this.world.setChildIndex(this.marquee, this.world.children.length - 1)
    }

    this.app?.renderer.render(this.app.stage)
  }

  setTool(tool: CanvasTool): void {
    this.tool = tool
  }

  setBrush(settings: BrushSettings): void {
    this.brush = settings
  }

  /**
   * The marquee borrows the accent colour. Only the value is refreshed, not the drawing: the
   * marquee exists solely while a selection is being dragged, and nothing is on screen to
   * repaint at the moment a theme changes.
   */
  private applyPalette(canvas: HTMLCanvasElement): void {
    this.overlayColor = tokenAsHex(canvas, '--color-accent', 0xffffff)
  }

  dispose(): void {
    this.disposed = true

    this.stopPaletteWatch?.()
    this.stopPaletteWatch = null

    const canvas = this.app?.canvas
    canvas?.removeEventListener('pointerdown', this.onPointerDown)
    canvas?.removeEventListener('pointermove', this.onPointerMove)
    canvas?.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('pointerup', this.onPointerUp)

    for (const surface of this.surfaces.values()) surface.texture.destroy(true)
    this.surfaces.clear()
    this.stamp.destroy()
    this.marquee.destroy()

    // `removeView`, because the canvas belongs to this engine now: leaving it behind would
    // stack a dead canvas per mount.
    this.app?.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
    this.app = null
  }

  private syncLayer(layer: Layer): void {
    let surface = this.surfaces.get(layer.id)

    if (!surface) {
      // Nothing is built before the renderer exists: a texture allocated against no GPU
      // context would take a stroke and never show it. `mount` replays the state.
      if (!this.app) return

      const texture = RenderTexture.create({
        width: this.size.width,
        height: this.size.height,
        resolution: 1,
      })
      const sprite = new Sprite(texture)
      surface = { texture, sprite }
      this.surfaces.set(layer.id, surface)
      this.world.addChild(sprite)

      if (layer.kind === 'pixel' && layer.fill !== undefined) this.fill(surface, layer.fill)
    }

    surface.sprite.visible = layer.visible
    surface.sprite.alpha = layer.opacity
    surface.sprite.blendMode = BLEND_BY_MODE[layer.blend] ?? 'normal'
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const point = this.toWorld(event)

    if (this.tool === 'picker') return this.pick(point)

    if (this.tool === 'fill') {
      const surface = this.activeSurface()
      if (!surface) return
      // Edge to edge, not a flood fill from the click: that is what gives a layer a plain
      // white, black or red background in one gesture.
      this.fill(surface, this.brush.color)
      this.options.onStrokeEnd()
      return
    }
    // Middle button pans whatever the tool: it is the one gesture no tool may take over.
    if (this.tool === 'hand' || event.button === 1) {
      this.panning = true
      this.last = { x: event.clientX, y: event.clientY }
      return
    }
    if (event.button !== 0) return

    // Below the middle-button branch on purpose: panning is the one gesture no tool may take
    // over, and these must not paint either — falling through would land them on the brush
    // path, so arming `Rectangle` would leave a dab.
    if (UNBUILT_TOOLS.has(this.tool)) return

    if (this.tool === 'move') {
      this.moving = true
      this.last = point
      return
    }

    if (this.tool === 'select') {
      this.selecting = { x: point.x, y: point.y, width: 0, height: 0 }
      this.last = point
      this.drawSelection()
      return
    }

    const surface = this.activeSurface()
    if (!surface) return

    this.painting = true
    this.last = point
    this.dab(surface, [point])
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.panning && this.last) {
      this.world.x += event.clientX - this.last.x
      this.world.y += event.clientY - this.last.y
      this.last = { x: event.clientX, y: event.clientY }
      return
    }

    const point = this.toWorld(event)

    if (this.moving && this.last) {
      const surface = this.activeSurface()
      if (surface) {
        surface.sprite.x += point.x - this.last.x
        surface.sprite.y += point.y - this.last.y
      }
      this.last = point
      return
    }

    if (this.selecting && this.last) {
      this.selecting = {
        x: Math.min(this.last.x, point.x),
        y: Math.min(this.last.y, point.y),
        width: Math.abs(point.x - this.last.x),
        height: Math.abs(point.y - this.last.y),
      }
      this.drawSelection()
      return
    }

    if (!this.painting || !this.last) return
    const surface = this.activeSurface()
    if (!surface) return

    this.stroke(surface, this.last, point)
    this.last = point
  }

  private readonly onPointerUp = (): void => {
    const finished = this.painting || this.moving
    this.painting = false
    this.panning = false
    this.moving = false
    this.last = null
    // One history entry per gesture: a command per dab would make ⌘Z useless.
    if (finished) this.options.onStrokeEnd()
  }

  /**
   * The marching-ants rectangle, drawn in the world so it follows pan and zoom. It is an
   * overlay, never rendered into a layer — a selection is not paint.
   */
  private drawSelection(): void {
    if (!this.selecting) return
    this.marquee.clear()
    this.marquee.rect(
      this.selecting.x,
      this.selecting.y,
      this.selecting.width,
      this.selecting.height,
    )
    this.marquee.stroke({ width: 1 / this.world.scale.x, color: this.overlayColor, alpha: 0.9 })
    this.app?.renderer.render(this.app.stage)
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 0.9 : 1.1
    this.world.scale.set(Math.min(16, Math.max(0.05, this.world.scale.x * factor)))
  }

  /** Paints a layer edge to edge, once, when it is born with a colour of its own. */
  private fill(surface: LayerSurface, color: number): void {
    const renderer = this.app?.renderer
    if (!renderer) return

    const sheet = new Graphics()
    sheet.rect(0, 0, this.size.width, this.size.height)
    sheet.fill({ color })
    renderer.render({ container: sheet, target: surface.texture, clear: false })
    sheet.destroy()
  }

  private activeSurface(): LayerSurface | null {
    return this.activeLayerId ? (this.surfaces.get(this.activeLayerId) ?? null) : null
  }

  private toWorld(event: PointerEvent): Point {
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
  private stroke(surface: LayerSurface, from: Point, to: Point): void {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const step = Math.max(1, this.brush.size / 4)
    const count = Math.ceil(distance / step)

    const points: Point[] = []
    for (let index = 1; index <= count; index += 1) {
      const ratio = index / count
      points.push({
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
      })
    }
    this.dab(surface, points)
  }

  /**
   * Every point of the segment in ONE render pass. A pass per point meant a framebuffer bind and
   * a draw call per interpolated dab — up to several hundred inside a single `pointermove`.
   *
   * It is also the only way the opacity comes out right: separate passes composite the dabs onto
   * each other, so a half-opaque stroke darkened at every joint.
   */
  private dab(surface: LayerSurface, points: readonly Point[]): void {
    const renderer = this.app?.renderer
    if (!renderer || points.length === 0) return

    const erasing = this.tool === 'eraser'
    this.stamp.clear()
    for (const point of points) this.stamp.circle(point.x, point.y, this.brush.size / 2)
    this.stamp.fill({ color: erasing ? 0xffffff : this.brush.color, alpha: this.brush.opacity })
    // Erasing is the same stroke in `erase` blend: on a transparent layer, painting white
    // would just paint white.
    this.stamp.blendMode = erasing ? 'erase' : 'normal'

    // `clear: false`, or every dab would wipe the stroke that came before it. And `target`,
    // not the `renderTexture` option, which v8 deprecated.
    renderer.render({ container: this.stamp, target: surface.texture, clear: false })
  }

  private pick(point: Point): void {
    const renderer = this.app?.renderer
    const surface = this.activeSurface()
    if (!renderer || !surface) return

    const x = Math.floor(point.x)
    const y = Math.floor(point.y)
    if (x < 0 || y < 0 || x >= this.size.width || y >= this.size.height) return

    // One pixel, not the whole layer: extracting a 1024² sprite to read a single colour means a
    // 4 MB allocation and a synchronous `readPixels` that stalls the pipeline on every click.
    const pixels = renderer.extract.pixels({
      target: surface.sprite,
      frame: new Rectangle(x, y, 1, 1),
    })

    const red = pixels.pixels[0] ?? 0
    const green = pixels.pixels[1] ?? 0
    const blue = pixels.pixels[2] ?? 0
    this.options.onPick((red << 16) | (green << 8) | blue)
  }
}
