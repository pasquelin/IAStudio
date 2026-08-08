// Without it Pixi knows none of the separable modes past `screen`: eleven of the sixteen fell
// back to `normal` silently, compositing wrongly with nothing to say so.
import 'pixi.js/advanced-blend-modes'
import {
  AlphaFilter,
  type Application,
  Container,
  Filter,
  Graphics,
  Rectangle,
  RenderTexture,
  Sprite,
  type BLEND_MODES,
} from 'pixi.js'
import { newId } from '@/helpers/ids'
import { isTyping } from '@/helpers/typing'
import { mountApplication } from '../core/mount'
import { onPaletteChange, token } from '../core/palette'
import {
  allLayers,
  IDENTITY,
  isGroup,
  layerById,
  type BlendMode,
  type CanvasState,
  type GroupLayer,
  type Layer,
  type Rect,
  type Transform,
} from './canvas-state'
import { composite, maskKey, placement, type CompositeNode } from './compositor'
import {
  CanvasOverlay,
  RULER_SIZE,
  type OverlayColors,
  type OverlayContext,
  type OverlayScene,
} from './CanvasOverlay'
import {
  boxEdges,
  guideNear,
  GUIDE_GRAB,
  snapOffset,
  snapTargets,
  snapValue,
  SNAP_TOLERANCE,
  type Axis,
} from './guides'
import { PixelPatches, type PatchSide } from './PixelPatches'
import { box, type Point } from './shape-geometry'
import { brushRect } from './tiles'
import {
  DEFAULT_VIEW,
  fitTo,
  sameViewport,
  toDocument,
  toScreen,
  zoomAt,
  type CanvasView,
  type Size,
  type Viewport,
} from './viewport'

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

/**
 * What the engine may do to the guides. It builds no id and runs no command: those belong to the
 * document's history, which lives on the React side.
 */
export type GuidePort = {
  /** Returns the id of the guide it created, so the engine can go on dragging it. */
  add: (axis: Axis, position: number) => string
  move: (id: string, position: number) => void
  remove: (id: string) => void
  /** Both ends of a drag: everything between them is one history entry. */
  beginDrag: () => void
  endDrag: () => void
}

/**
 * What the engine may do to the layer stack. Same shape and same reason as `GuidePort`: the
 * engine knows where the pointer went, the document's history knows what that means.
 */
export type LayerPort = {
  /** Absolute, not a step: the commands of one drag merge, and only the last one survives. */
  translate: (id: string, x: number, y: number) => void
  beginDrag: () => void
  endDrag: () => void
}

export type CanvasEngineOptions = {
  /** Reports the colour under the pointer, so the picker can feed the swatch back. */
  onPick: (color: number) => void
  /**
   * Fires once a stroke is finished, with the id of the patch that can undo it — one history
   * entry per gesture, not per pixel.
   */
  onPixels: (patchId: string) => void
  /** The tiles of that patch have been thrown away: its history entry can no longer be replayed. */
  onPixelsDropped: (patchId: string) => void
  /** Pan and zoom are session state: the engine moves them, React stores them. */
  onViewport: (viewport: Viewport) => void
  /** The host's size, which the zoom commands need: they centre on a panel they cannot see. */
  onHost: (size: Size) => void
  guides: GuidePort
  layers: LayerPort
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
 * Pixi's own name for each mode. Total on purpose: a mode added to `BlendMode` and forgotten here
 * must be a compile error, not a layer that quietly composites as `normal`.
 *
 * `hue` is the one exception, and it is deliberate: Pixi 8.19 commented it out of its own union
 * and ships no filter for it, so the literal would not even typecheck.
 */
export const BLEND_BY_MODE: Record<BlendMode, BLEND_MODES> = {
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
  hue: 'normal',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
}

// The advanced modes are filters, and a filter renders at resolution 1 by default: on a retina
// canvas the blended layer came out clipped and half-scaled.
Filter.defaultOptions.resolution = 'inherit'

type LayerSurface = {
  texture: RenderTexture
  sprite: Sprite
}

/** Which of a layer's two surfaces the brush writes on. */
export type PaintSurface = 'pixels' | 'mask'

/** A surface a gesture may write to, with the key its undo patches are filed under. */
type BrushTarget = { key: string; surface: LayerSurface }

/** The stencil that cuts a clipped layer out of the one below it, and what holds the pair. */
type ClipProxy = { baseId: string; sprite: Sprite; host: Container }

/** What the pointer is doing, if anything: the gestures are exclusive by construction. */
type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; from: Point }
  | { kind: 'guide'; id: string; axis: Axis }
  | { kind: 'paint'; from: Point }
  /** `origin` is where the layer stood when the drag began: every step is absolute from it. */
  | { kind: 'move'; id: string; from: Point; origin: Point }
  | { kind: 'select'; from: Point }

const NO_GESTURE: Gesture = { kind: 'none' }

/** Which token each part of the overlay is painted with. The values live in `index.css`. */
const OVERLAY_TOKENS: Record<keyof OverlayColors, string> = {
  frame: '--color-border',
  guide: '--color-accent-soft',
  rulerBackground: '--color-chassis',
  rulerText: '--color-muted',
  rulerTick: '--color-border',
  accent: '--color-accent',
}

/** Legible on the studio's greys, and only ever used before a canvas exists to read from. */
const FALLBACK_COLORS: OverlayColors = {
  frame: '#34363a',
  guide: '#2e436e',
  rulerBackground: '#2b2d30',
  rulerText: '#868a91',
  rulerTick: '#34363a',
  accent: '#3574f0',
}

function readColors(element: HTMLElement): OverlayColors {
  const read = (part: keyof OverlayColors): string =>
    token(element, OVERLAY_TOKENS[part]) || FALLBACK_COLORS[part]

  return {
    frame: read('frame'),
    guide: read('guide'),
    rulerBackground: read('rulerBackground'),
    rulerText: read('rulerText'),
    rulerTick: read('rulerTick'),
    accent: read('accent'),
  }
}

/**
 * The Pixi side of an image document. It owns the pixels — a GPU texture per layer — and the
 * view they are seen through; the stack, its order and its opacities are read from the state it
 * is handed.
 *
 * No React import (invariant 4). What can be decided without a GPU lives in `canvas-state`,
 * `commands`, `viewport`, `rulers`, `guides` and `CanvasOverlay`, which are all tested — jsdom
 * has no WebGL context, so nothing testable is allowed to stay in this file.
 */
export class CanvasEngine {
  private app: Application | null = null
  private host: HTMLElement | null = null
  private readonly world = new Container()
  private readonly surfaces = new Map<string, LayerSurface>()
  private readonly groups = new Map<string, Container>()
  /** One per clipped layer, keyed by it: a run of three on one base takes three proxies. */
  private readonly clips = new Map<string, ClipProxy>()
  /** Built on the first isolated group, and only then: most documents never hold one. */
  private isolation: AlphaFilter | null = null
  private readonly stamp = new Graphics()
  private readonly overlay = new CanvasOverlay(() => this.scene())
  /** Built with the renderer, in `mount`: a tile is a texture, and there is none before then. */
  private patches: PixelPatches | null = null
  private resizer: ResizeObserver | null = null
  private stopPaletteWatch: (() => void) | null = null

  private tool: CanvasTool = 'brush'
  private painting: PaintSurface = 'pixels'
  private brush: BrushSettings = DEFAULT_BRUSH
  private state: CanvasState | null = null
  private view: CanvasView = DEFAULT_VIEW
  private hostSize: Size = { width: 0, height: 0 }
  private colors: OverlayColors = FALLBACK_COLORS
  /** Read on resize rather than per event: `getBoundingClientRect` forces a layout. */
  private bounds: DOMRect | null = null

  /** The tree's shape, as `placement` spells it: what tells a restack apart from a repaint. */
  private stacking = ''

  private gesture: Gesture = NO_GESTURE
  private pointer: Point | null = null
  private selection: Rect | null = null
  /** Moved locally, published to React once a frame — see `moveTo`. */
  private publishing: Viewport | null = null
  /** The last one React was told about, so its echo can be told apart from a command. */
  private published: Viewport | null = null
  private publishFrame = 0
  /** Held space pans whatever the tool, as it does in every editor. */
  private spacing = false
  /** The view has never been framed on the document, so the first size does it. */
  private framed = false
  /**
   * Bumped by every `mount` and every `dispose`. Compared after the `await` in `mount`: a stale
   * continuation must not claim a host that a newer mount — or a dispose — has already taken.
   */
  private mounting = 0

  constructor(private readonly options: CanvasEngineOptions) {}

  async mount(host: HTMLElement): Promise<void> {
    const mounting = (this.mounting += 1)
    const app = await mountApplication(
      {
        resizeTo: host,
        backgroundAlpha: 0,
        // Nothing here animates by itself: every change calls `render`. Left on, Pixi would draw
        // the whole stage sixty times a second for a document nobody is touching.
        autoStart: false,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio,
        // The advanced blend modes read the back buffer. Without it WebGL warns once and
        // composites every one of them as `normal`.
        useBackBuffer: true,
      },
      // The mount counter rather than `disposed`: it also catches a remount onto the same
      // engine, where the first `init` resolves after the second has claimed the element.
      () => mounting !== this.mounting,
    )
    if (!app) return

    const canvas = app.canvas
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    host.appendChild(canvas)

    this.app = app
    this.host = host
    this.patches = new PixelPatches(app.renderer, this.options.onPixelsDropped)
    app.stage.addChild(this.world)
    this.readPalette(canvas)
    // The theme can change while a document is open, and the overlay is the one surface that
    // holds its colours in JavaScript rather than in CSS.
    this.stopPaletteWatch = onPaletteChange(() => this.readPalette(canvas))
    this.overlay.mount(host)

    host.addEventListener('pointerdown', this.onPointerDown)
    host.addEventListener('pointermove', this.onPointerMove)
    host.addEventListener('pointerleave', this.onPointerLeave)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    host.addEventListener('wheel', this.onWheel, { passive: false })

    this.resizer = new ResizeObserver(() => this.measure())
    this.resizer.observe(host)
    this.measure()

    // React pushed the state while `init` was still in flight — it always does, the effect that
    // pushes it runs in the same flush as the one that mounts. Reconciling directly rather than
    // through `apply`, whose guard would see the state it already holds and do nothing: that is
    // the difference between a document that opens paintable and one that opens empty.
    this.reconcile()
    this.render()
  }

  /** Reflects a state it never computes: layers appear, reorder and fade from here only. */
  apply(state: CanvasState): void {
    const previous = this.state
    const resized = previous?.width !== state.width || previous?.height !== state.height
    this.state = state
    this.overlay.invalidate()

    // Dragging a guide rewrites the state sixty times a second and touches no pixel: walking the
    // tree and re-rendering the stage for it would be a full GPU frame per pointer move.
    if (previous && previous.layers === state.layers && !resized) return

    this.reconcile()
    if (resized && this.framed) this.frameDocument()
    this.render()
  }

  /** The stack, made real on the GPU: one texture per paintable layer, in the stack's order. */
  private reconcile(): void {
    const state = this.state
    if (!state) return

    // The whole tree, not the root: a group holds layers, and a surface judged missing here is
    // a texture destroyed on the GPU. Grouping two layers used to lose their pixels outright.
    const layers = allLayers(state.layers)
    for (const layer of layers) {
      if (isGroup(layer)) this.syncGroup(layer, state)
      else this.syncLayer(layer)
    }

    // Nothing has been built yet, so no placement has been made either: remembering one here
    // would make the replay in `mount` skip the very tree it exists to build.
    if (!this.app) return

    // Dragging a layer rewrites the stack sixty times a second without restacking it, and the
    // pass below detaches and reattaches every node of the document.
    const nodes = composite(state.layers)
    const stacking = placement(nodes)
    if (stacking !== this.stacking) {
      this.stacking = stacking
      // The tree first: it leaves whatever departed orphaned, so nothing is destroyed while it
      // is still someone's child.
      this.attach(nodes, this.world)
      this.dropDeparted(layers)
    }

    // Last, and outside the guard: `attach` is where a proxy is born, and a base that moved
    // without restacking still has to drag its stencil along.
    this.refreshClips()
  }

  /** Frees what the stack no longer holds. A layer that left took its pixels with it. */
  private dropDeparted(layers: readonly Layer[]): void {
    const kept = new Set<string>()
    for (const layer of layers) {
      kept.add(layer.id)
      // Its presence, not `enabled`: unticking the box hides a mask, it does not erase it.
      if (layer.mask) kept.add(maskKey(layer.id))
    }

    for (const [id, surface] of this.surfaces) {
      if (kept.has(id)) continue
      surface.sprite.destroy()
      // The texture lives on the GPU: dropping the reference is not enough.
      surface.texture.destroy(true)
      this.surfaces.delete(id)
    }

    for (const [id, container] of this.groups) {
      if (kept.has(id)) continue
      // Emptied first, and destroyed without `children`: ungrouping keeps the layers, and
      // taking their sprites down with the container is the same lost-pixels bug in reverse.
      container.removeChildren()
      container.destroy()
      this.groups.delete(id)
    }

    const clipping = new Set(layers.filter(layer => layer.clipped).map(layer => layer.id))
    for (const [id, clip] of this.clips) {
      if (clipping.has(id) && this.surfaces.has(clip.baseId)) continue
      clip.host.removeChildren()
      // Without its texture: the proxy is the one sprite that borrows another layer's.
      clip.sprite.destroy()
      clip.host.destroy()
      this.clips.delete(id)
    }
  }

  /** Bottom first, so the last node of a level is the one the eye sees on top. */
  private attach(nodes: readonly CompositeNode[], parent: Container): void {
    parent.removeChildren()

    for (const node of nodes) {
      if (node.kind === 'group') {
        const container = this.groups.get(node.id)
        if (!container) continue
        this.attach(node.children, container)
        parent.addChild(container)
        continue
      }

      const surface = this.surfaces.get(node.id)
      if (!surface) continue

      // A clipped layer hangs in a container of its own: an object carries one mask, and a
      // clipped layer that also has a mask of its own needs two.
      const clip = node.clippedBy === null ? null : this.clipProxy(node.id, node.clippedBy)
      const holder = clip ?? parent

      const mask =
        node.maskedBy === null ? null : (this.surfaces.get(maskKey(node.maskedBy)) ?? null)
      // Pixi reads the alpha of whatever it is handed, and only if that object is in the tree:
      // the mask sprite is attached alongside the layer it hides, and never drawn on its own.
      if (mask) holder.addChild(mask.sprite)
      surface.sprite.mask = mask?.sprite ?? null

      holder.addChild(surface.sprite)
      if (clip) parent.addChild(clip)
    }
  }

  /**
   * The container that cuts a clipped layer out of the one below it, emptied and ready to be
   * filled. `null` when the base holds no pixels — a clipped layer with nothing under it is not
   * clipped at all, and hiding it would lose its pixels for a reason nobody could see.
   */
  private clipProxy(layerId: string, baseId: string): Container | null {
    const base = this.surfaces.get(baseId)
    if (!base) return null

    let clip = this.clips.get(layerId)
    if (clip?.baseId !== baseId) {
      clip?.host.removeChildren()
      clip?.sprite.destroy()
      clip?.host.destroy()
      // The base is already being drawn: an object cannot be both the picture and the stencil,
      // so the proxy shares its texture and nothing else. Three clipped layers on one base take
      // three proxies, and all three stay visible.
      const sprite = new Sprite(base.texture)
      const host = new Container()
      host.mask = sprite
      clip = { baseId, sprite, host }
      this.clips.set(layerId, clip)
    }

    clip.host.removeChildren()
    clip.host.addChild(clip.sprite)
    return clip.host
  }

  /** The proxies follow their base: a stencil a frame behind the layer it cuts would show a seam. */
  private refreshClips(): void {
    const state = this.state
    if (!state) return

    for (const clip of this.clips.values()) {
      const base = this.surfaces.get(clip.baseId)
      const layer = layerById(state, clip.baseId)
      // From the state, through the one placement path the engine has: a second one would drift.
      if (base && layer) this.place(clip.sprite, layer.transform, base.texture)
    }
  }

  private syncGroup(layer: GroupLayer, box: Size): void {
    let container = this.groups.get(layer.id)
    if (!container) {
      container = new Container({ label: layer.id })
      this.groups.set(layer.id, container)
    }

    container.visible = layer.visible
    container.alpha = layer.opacity
    container.blendMode = BLEND_BY_MODE[layer.blend]
    // An isolated group composites on itself before the stack sees it, which is what an offscreen
    // pass does — and a neutral filter is the only way v8 offers to ask for one. Empty otherwise:
    // a filter on every group would cost a render target per group for nothing.
    //
    // Written only when it turns: Pixi copies and freezes the array on every assignment, and
    // this runs for every group of the document on every state it is handed.
    const isolated = layer.isolation === 'isolate'
    if (isolated !== (container.filters ?? []).length > 0) {
      container.filters = isolated ? [this.isolationPass()] : []
    }
    // A group holds no texture, so the document is the box its origin is a fraction of.
    this.place(container, layer.transform, box)
  }

  private isolationPass(): AlphaFilter {
    // One per engine, shared by every isolated group: a filter carries no per-object state.
    this.isolation ??= new AlphaFilter()
    return this.isolation
  }

  /** Pan, zoom, and what the overlay shows. Pushed in, never read out: React owns it. */
  setView(view: CanvasView): void {
    // Only the engine's own viewport coming back is stale — taking it would snap the canvas to
    // where the pan was a frame ago. Anything else is a command (⌘0 during a trackpad glide,
    // typically), and swallowing it would lose it in both the engine and the store.
    const echo = this.published !== null && sameViewport(view.viewport, this.published)
    this.view = { ...view, viewport: echo ? (this.publishing ?? view.viewport) : view.viewport }
    this.applyViewport()
  }

  private applyViewport(): void {
    const { x, y, scale } = this.view.viewport
    this.world.position.set(x, y)
    this.world.scale.set(scale)
    this.overlay.invalidate()
    this.render()
  }

  /**
   * Moves the view now and tells React once a frame. Routing every pointer move through the store
   * and back would put a React commit between the gesture and the pixels it moves — the zoom
   * readout is the only thing that needs to hear about it, and it can hear about it a frame later.
   */
  private moveTo(viewport: Viewport): void {
    this.view = { ...this.view, viewport }
    this.applyViewport()

    this.publishing = viewport
    if (this.publishFrame === 0) this.publishFrame = requestAnimationFrame(this.publish)
  }

  private readonly publish = (): void => {
    this.publishFrame = 0
    const viewport = this.publishing
    this.publishing = null
    if (!viewport) return

    this.published = viewport
    this.options.onViewport(viewport)
  }

  setTool(tool: CanvasTool): void {
    this.tool = tool
  }

  setBrush(settings: BrushSettings): void {
    this.brush = settings
  }

  /**
   * Aims the brush at the layer's pixels or at its mask. A mask is painted with the same tools as
   * anything else — that is the point of it being a surface like the others.
   */
  setPaintTarget(target: PaintSurface): void {
    this.painting = target
  }

  /**
   * The first sight of a document, and the reframing a resized frame calls for. ⌘0 does NOT come
   * through here: it is a command, and it goes through the same store path as the zoom bar.
   */
  private frameDocument(): void {
    if (!this.state || this.hostSize.width === 0) return
    this.framed = true
    const document = { width: this.state.width, height: this.state.height }
    this.moveTo(fitTo(document, this.hostSize, this.view.rulers ? RULER_SIZE : 0))
  }

  dispose(): void {
    this.mounting += 1

    const host = this.host
    host?.removeEventListener('pointerdown', this.onPointerDown)
    host?.removeEventListener('pointermove', this.onPointerMove)
    host?.removeEventListener('pointerleave', this.onPointerLeave)
    host?.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)

    this.stopPaletteWatch?.()
    this.stopPaletteWatch = null

    cancelAnimationFrame(this.publishFrame)
    this.resizer?.disconnect()
    this.resizer = null
    this.overlay.dispose()
    this.patches?.dispose()
    this.patches = null

    for (const surface of this.surfaces.values()) surface.texture.destroy(true)
    this.surfaces.clear()
    for (const container of this.groups.values()) container.destroy()
    this.groups.clear()
    for (const clip of this.clips.values()) clip.host.destroy()
    this.clips.clear()
    this.isolation?.destroy()
    this.isolation = null
    this.stamp.destroy()

    // `removeView`, because the canvas belongs to this engine now: leaving it behind would
    // stack a dead canvas per mount.
    this.app?.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
    this.app = null
    this.host = null
  }

  private readPalette(canvas: HTMLCanvasElement): void {
    this.colors = readColors(canvas)
    this.overlay.invalidate()
  }

  private measure(): void {
    const host = this.host
    if (!host) return

    this.bounds = host.getBoundingClientRect()
    this.hostSize = { width: host.clientWidth, height: host.clientHeight }
    this.overlay.resize(this.hostSize)
    this.options.onHost(this.hostSize)
    // The document has never been framed, and now there is something to frame it in.
    if (!this.framed && this.hostSize.width > 0) this.frameDocument()
    this.render()
  }

  private scene(): OverlayScene | null {
    if (!this.state) return null

    return {
      viewport: this.view.viewport,
      host: this.hostSize,
      document: { width: this.state.width, height: this.state.height },
      showRulers: this.view.rulers,
      showGuides: this.view.guides,
      guides: this.state.guides,
      activeGuideId: this.gesture.kind === 'guide' ? this.gesture.id : null,
      pointer: this.pointer,
      colors: this.colors,
      paint: this.selection ? this.paintSelection : undefined,
    }
  }

  /** The marquee, in screen space: a selection is chrome, and chrome never scales. */
  private readonly paintSelection = (context: OverlayContext): void => {
    const rect = this.selection
    if (!rect) return

    const start = toScreen(this.view.viewport, rect)
    const end = toScreen(this.view.viewport, { x: rect.x + rect.width, y: rect.y + rect.height })

    context.strokeStyle = this.colors.accent
    context.setLineDash([4, 4])
    context.strokeRect(
      Math.round(start.x) + 0.5,
      Math.round(start.y) + 0.5,
      Math.round(end.x - start.x),
      Math.round(end.y - start.y),
    )
    context.setLineDash([])
  }

  private render(): void {
    if (this.app) this.app.renderer.render(this.app.stage)
  }

  private syncLayer(layer: Layer): void {
    const surface = this.buildSurface(layer.id, layer.kind === 'pixel' ? layer.fill : undefined)
    if (!surface) return

    surface.sprite.visible = layer.visible
    // `fillOpacity` is meant to fade the pixels while leaving the effects drawn around them at
    // full strength. No layer effect exists yet, so for now the two simply multiply.
    surface.sprite.alpha = layer.opacity * layer.fillOpacity
    surface.sprite.blendMode = BLEND_BY_MODE[layer.blend]
    this.place(surface.sprite, layer.transform, surface.texture)

    // Allocated only where the state asks for one: a mask per layer, built ahead, would double
    // the document's GPU memory for a feature most layers never use.
    if (!layer.mask) return
    const mask = this.buildSurface(maskKey(layer.id))
    // Unlinked means the mask does not follow the layer: it stays where it was painted.
    if (mask) this.place(mask.sprite, layer.mask.linked ? layer.transform : IDENTITY, mask.texture)
  }

  /** A document-sized texture and the sprite that shows it, built once and kept. */
  private buildSurface(key: string, fill?: number): LayerSurface | null {
    const existing = this.surfaces.get(key)
    if (existing) return existing

    // Nothing is built before the renderer exists: a texture allocated against no GPU context
    // would take a stroke and never show it. `mount` replays the state.
    if (!this.app || !this.state) return null

    const texture = RenderTexture.create({
      width: this.state.width,
      height: this.state.height,
      resolution: 1,
    })
    // Attached by `attach`, which is the only place that knows which container holds it.
    const surface: LayerSurface = { texture, sprite: new Sprite(texture) }
    this.surfaces.set(key, surface)

    if (fill !== undefined) this.fill(surface, fill)
    return surface
  }

  /**
   * Read from the state, never written from here: a node nudged in place is a position the next
   * `apply` throws away and no undo ever hears about.
   */
  private place(target: Container, transform: Transform, box: Size): void {
    // The origin is a fraction of the box, so a resize leaves the pivot where it was.
    const pivotX = transform.originX * box.width
    const pivotY = transform.originY * box.height

    target.pivot.set(pivotX, pivotY)
    // A pivot displaces the node by itself: without this, moving the origin of an otherwise
    // untouched layer would slide it across the document.
    target.position.set(transform.x + pivotX, transform.y + pivotY)
    target.rotation = transform.rotation
    target.scale.set(transform.scaleX, transform.scaleY)
    target.skew.set(transform.skewX, transform.skewY)
  }

  /**
   * Paints one end of a recorded gesture back into its layer. Called by the history, which holds
   * the patch id and nothing else — the tiles themselves never leave this side of the line.
   *
   * `false` says the tiles are gone: the caller must drop the entry rather than show a ⌘Z that
   * quietly does nothing.
   */
  restorePixels(patchId: string, side: PatchSide): boolean {
    const patches = this.patches
    const surfaceId = patches?.surfaceOf(patchId)
    const surface = surfaceId ? this.surfaces.get(surfaceId) : null
    if (!patches || !surface) return false

    const done = patches.restore(patchId, side, surface.texture)
    if (done) this.render()
    return done
  }

  /**
   * Host-relative screen pixels — the space the overlay draws in. The rectangle is the cached
   * one: reading it per event forces a layout, and it is refreshed on resize and on every
   * pointer down, which is what every gesture starts with.
   */
  private toHost(event: PointerEvent | WheelEvent): Point {
    const bounds = this.bounds
    if (!bounds) return { x: 0, y: 0 }
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  /**
   * Which band the point is in, `'corner'` for the square where they meet, `null` for the canvas.
   * The corner is inert but it is still chrome: without it a click there left a brush dab, and
   * the bucket filled the whole layer.
   */
  private inRuler(point: Point): Axis | 'corner' | null {
    if (!this.view.rulers) return null
    if (point.x >= RULER_SIZE && point.y >= RULER_SIZE) return null
    // The top band lays horizontal guides, which are pinned on the y axis, and the reverse for
    // the left one.
    if (point.x < RULER_SIZE && point.y < RULER_SIZE) return 'corner'
    return point.y < RULER_SIZE ? 'y' : 'x'
  }

  /**
   * Where a dragged layer wants to land. Both of its sides and its middle are candidates on each
   * axis, so it sticks to a guide by whichever edge reaches it first — the same magnetism the
   * guides themselves have, applied to a box rather than to a line.
   */
  private snappedMove(origin: Point, from: Point, to: Point): Point {
    const raw = { x: origin.x + to.x - from.x, y: origin.y + to.y - from.y }
    const state = this.state
    if (!this.view.snap || !state) return raw

    const tolerance = SNAP_TOLERANCE / this.view.viewport.scale
    return {
      x: raw.x + snapOffset(boxEdges(raw.x, state.width), snapTargets(state, 'x'), tolerance),
      y: raw.y + snapOffset(boxEdges(raw.y, state.height), snapTargets(state, 'y'), tolerance),
    }
  }

  /** Magnetism is a screen-space feeling: the tolerance shrinks in document units as you zoom. */
  private snapped(value: number, axis: Axis): number {
    if (!this.view.snap || !this.state) return value
    return snapValue(
      value,
      snapTargets(this.state, axis),
      SNAP_TOLERANCE / this.view.viewport.scale,
    )
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    // A panel can be dragged or a sidebar collapsed without the host resizing; the start of a
    // gesture is the one moment where a stale rectangle would be felt as an offset stroke.
    this.bounds = this.host?.getBoundingClientRect() ?? this.bounds
    const host = this.toHost(event)
    const point = toDocument(this.view.viewport, host)
    this.pointer = host

    // Middle button pans whatever the tool: it is the one gesture no tool may take over. It can
    // land mid-drag, so whatever was open is closed rather than abandoned — a guide gesture left
    // open would make the next drag of that guide re-create it instead of moving it.
    if (event.button === 1 || this.spacing || this.tool === 'hand') {
      this.endGesture()
      this.gesture = { kind: 'pan', from: host }
      this.setCursor('grabbing')
      return
    }
    if (event.button !== 0) return

    const band = this.inRuler(host)
    if (band === 'corner') return
    if (band !== null) {
      const position = this.snapped(band === 'x' ? point.x : point.y, band)
      this.options.guides.beginDrag()
      this.gesture = { kind: 'guide', id: this.options.guides.add(band, position), axis: band }
      return
    }

    const grabbed = this.grabGuide(point)
    if (grabbed) {
      this.options.guides.beginDrag()
      this.gesture = { kind: 'guide', id: grabbed.id, axis: grabbed.axis }
      return
    }

    if (this.tool === 'picker') return this.pick(point)

    if (this.tool === 'fill') {
      const target = this.paintTarget()
      const frame = target && this.beginPixels(target)
      if (!target || !frame) return

      this.patches?.touch(frame)
      // Edge to edge, not a flood fill from the click: that is what gives a layer a plain
      // white, black or red background in one gesture.
      this.fill(target.surface, this.brush.color)
      this.endPixels()
      return
    }

    // Below the pan branch on purpose: panning is the one gesture no tool may take over, and
    // these must not paint either — falling through would land them on the brush path, so
    // arming `Rectangle` would leave a dab.
    if (UNBUILT_TOOLS.has(this.tool)) return

    if (this.tool === 'move') {
      const layer = this.activeLayer()
      if (!layer || layer.locked.position) return

      this.options.layers.beginDrag()
      this.gesture = {
        kind: 'move',
        id: layer.id,
        from: point,
        origin: { x: layer.transform.x, y: layer.transform.y },
      }
      return
    }

    if (this.tool === 'select') {
      this.gesture = { kind: 'select', from: point }
      this.selection = { x: point.x, y: point.y, width: 0, height: 0 }
      this.overlay.invalidate()
      return
    }

    const target = this.paintTarget()
    if (!target) return

    this.beginPixels(target)
    this.gesture = { kind: 'paint', from: point }
    this.dab(target.surface, [point])
  }

  private activeLayer(): Layer | null {
    return this.state ? layerById(this.state, this.state.activeLayerId) : null
  }

  /** The surface a stroke may land on: armed, able to hold pixels, and not padlocked. */
  private paintTarget(): BrushTarget | null {
    const layer = this.activeLayer()
    if (!layer || isGroup(layer) || layer.locked.pixels) return null

    const surface = this.activeSurface()
    // No surface means the layer carries no mask while the brush aims at one: there is nothing
    // to paint, and nothing to say about it either.
    return surface ? { key: this.paintKey(layer.id), surface } : null
  }

  private documentRect(): Rect | null {
    const state = this.state
    return state ? { x: 0, y: 0, width: state.width, height: state.height } : null
  }

  /** Returns the document's own rectangle, which the bucket then dirties whole. */
  private beginPixels(target: BrushTarget): Rect | null {
    const frame = this.documentRect()
    if (frame) this.patches?.begin(newId(), target.key, target.surface.texture, frame)
    return frame
  }

  private endPixels(): void {
    const patchId = this.patches?.end() ?? null
    if (patchId) this.options.onPixels(patchId)
  }

  /** The guide under the pointer, tested in screen pixels so it stays grabbable at any zoom. */
  private grabGuide(point: Point): { id: string; axis: Axis } | null {
    if (!this.state || !this.view.guides) return null

    const tolerance = GUIDE_GRAB / this.view.viewport.scale
    const vertical = guideNear(this.state.guides, 'x', point.x, tolerance)
    if (vertical) return { id: vertical.id, axis: 'x' }

    const horizontal = guideNear(this.state.guides, 'y', point.y, tolerance)
    return horizontal ? { id: horizontal.id, axis: 'y' } : null
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const host = this.toHost(event)
    this.pointer = host
    // The rulers echo the pointer, so an idle move still costs one overlay frame.
    if (this.view.rulers) this.overlay.invalidate()

    const gesture = this.gesture
    if (gesture.kind === 'none') return

    if (gesture.kind === 'pan') {
      const viewport = this.view.viewport
      this.moveTo({
        ...viewport,
        x: viewport.x + host.x - gesture.from.x,
        y: viewport.y + host.y - gesture.from.y,
      })
      this.gesture = { kind: 'pan', from: host }
      return
    }

    // Every remaining gesture works in document space; the pan is the only one that does not,
    // and an idle hover — the common case — must not pay for the conversion at all.
    const point = toDocument(this.view.viewport, host)

    switch (gesture.kind) {
      case 'guide': {
        const raw = gesture.axis === 'x' ? point.x : point.y
        this.options.guides.move(gesture.id, this.snapped(raw, gesture.axis))
        return
      }
      case 'move': {
        const to = this.snappedMove(gesture.origin, gesture.from, point)
        this.options.layers.translate(gesture.id, to.x, to.y)
        return
      }
      case 'select': {
        this.selection = box(gesture.from, point, event.shiftKey)
        this.overlay.invalidate()
        return
      }
      case 'paint': {
        const surface = this.activeSurface()
        if (surface) this.stroke(surface, gesture.from, point)
        this.gesture = { kind: 'paint', from: point }
        return
      }
    }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    // The corner counts: a guide dropped anywhere on the chrome is a guide thrown away.
    const onChrome = this.inRuler(this.toHost(event)) !== null
    this.setCursor('')
    this.endGesture(onChrome)
  }

  /** Closes whatever gesture is open, exactly once, whether it ended or was taken over. */
  private endGesture(dropped = false): void {
    const gesture = this.gesture
    this.gesture = NO_GESTURE

    if (gesture.kind === 'guide') {
      if (dropped) this.options.guides.remove(gesture.id)
      this.options.guides.endDrag()
      this.overlay.invalidate()
      return
    }

    // One history entry per gesture: a command per dab, or per pointer move, would make ⌘Z useless.
    if (gesture.kind === 'move') this.options.layers.endDrag()
    if (gesture.kind === 'paint') this.endPixels()
  }

  private readonly onPointerLeave = (): void => {
    this.pointer = null
    this.overlay.invalidate()
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // A space typed into a prompt is a space, not a pan.
    if (event.code !== 'Space' || event.repeat || isTyping(event.target)) return
    this.spacing = true
    this.setCursor('grab')
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space') this.releaseSpace()
  }

  /** ⌘Tab while space is held: the key up never arrives, and the hand cursor would stay for good. */
  private readonly onBlur = (): void => this.releaseSpace()

  private releaseSpace(): void {
    this.spacing = false
    if (this.gesture.kind !== 'pan') this.setCursor('')
  }

  private setCursor(cursor: string): void {
    // On Pixi's canvas rather than the host: React owns the host's cursor, and the canvas fills
    // it, so this wins for as long as the gesture lasts and gives it back on release.
    if (this.app) this.app.canvas.style.cursor = cursor
  }

  /**
   * Trackpads send a pinch as a wheel with `ctrlKey`, which is also how ⌘/Ctrl + wheel arrives:
   * both mean zoom. A bare wheel scrolls, as it does in Figma — the document moves under a still
   * pointer instead of jumping a zoom step per notch.
   */
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    // Once per wheel event rather than once per gesture: a zoom has no pointer down to refresh
    // the rectangle, and a panel moved without resizing would anchor the zoom next to the cursor.
    this.bounds = this.host?.getBoundingClientRect() ?? this.bounds
    const viewport = this.view.viewport

    if (event.ctrlKey || event.metaKey) {
      // Exponential, so a notch feels the same at 5% and at 800%.
      const scale = viewport.scale * Math.exp(-event.deltaY / 250)
      this.moveTo(zoomAt(viewport, scale, this.toHost(event)))
      return
    }

    this.moveTo({ ...viewport, x: viewport.x - event.deltaX, y: viewport.y - event.deltaY })
  }

  /** Paints a layer edge to edge, once, when it is born with a colour of its own. */
  private fill(surface: LayerSurface, color: number): void {
    const renderer = this.app?.renderer
    if (!renderer || !this.state) return

    const sheet = new Graphics()
    sheet.rect(0, 0, this.state.width, this.state.height)
    sheet.fill({ color })
    renderer.render({ container: sheet, target: surface.texture, clear: false })
    sheet.destroy()
  }

  /** Where the brush writes on the active layer: its own pixels, or the mask that hides them. */
  private activeSurface(): LayerSurface | null {
    const id = this.state?.activeLayerId
    return id ? (this.surfaces.get(this.paintKey(id)) ?? null) : null
  }

  private paintKey(layerId: string): string {
    return this.painting === 'mask' ? maskKey(layerId) : layerId
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

    // Before a single pixel is written: what the tiles hold now is what an undo will put back.
    this.patches?.touch(brushRect(points, this.brush.size / 2))

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
    this.render()
  }

  private pick(point: Point): void {
    const renderer = this.app?.renderer
    const surface = this.activeSurface()
    if (!renderer || !surface || !this.state) return

    const x = Math.floor(point.x)
    const y = Math.floor(point.y)
    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) return

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
