import {
  AlphaFilter,
  type Application,
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Matrix,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  type BLEND_MODES,
  type ICanvas,
  type Texture,
} from 'pixi.js'
import { assetUrl } from '@shared/domain/asset'
import type { BlendMode } from '@shared/domain/canvasBlend'
import { colourOf } from '@shared/domain/color'
import { fontKey } from '@shared/domain/font'
import { bytesToBase64 } from '@/helpers/base64'
import { newId } from '@/helpers/ids'
import { isTyping } from '@/helpers/typing'
import { reportFailure } from '@/services/diagnostics'
import { mountApplication } from '../core/mount'
import { onPaletteChange, token, tokenAsFont } from '../core/palette'
import { createAdjustFilter, type AdjustFilter } from './adjustFilter'
import { captionsSetIn, faceUrlOf, familyStack, type FaceRegistrar } from './canvasFonts'
import {
  allLayers,
  IDENTITY,
  isGroup,
  layerById,
  type AdjustmentLayer,
  type CanvasState,
  DEFAULT_TEXT_BOX,
  type DrawnShape,
  type GroupLayer,
  type Layer,
  type Rect,
  type ShapeKind,
  type ShapeLayer,
  type TextLayer,
  type Transform,
  WHITE,
} from './canvasState'
import {
  dragSelection,
  extendLasso,
  isEmptySelection,
  selectionOutline,
  type CanvasSelection,
  type SelectionShape,
} from './canvasSelection'
import { composite, maskKey, placement, type CompositeNode } from './compositor'
import { applyTo, compose, invert, layerMatrix, mapRect, type Affine } from './layerSpace'
import {
  centerOf,
  cornersOfRect,
  hitTest,
  HANDLE_GRAB,
  layerCornersOf,
  resizeBy,
  rotateBy,
  ROTATE_REACH,
  wholeOf,
  type Corners,
  type HandleHit,
  type HandleId,
} from './handles'
import { resizeCursor, rotateCursor, UPRIGHT, type Facing } from './cursors'
import {
  CanvasOverlay,
  RULER_SIZE,
  type OverlayColors,
  type OverlayScene,
  type PendingShape,
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
import { cropRect, resizeCrop } from './crop'
import {
  box,
  constrainedTo,
  localShape,
  paintShape,
  shapeGeometry,
  type ShapeGeometry,
} from './shapeGeometry'
import type { Point, Size } from '../core/geometry'
import { blurRadius, DEFAULT_BRUSH, readsBrushSetting, type BrushSettings } from './brush'
import type { CanvasTool } from './canvasTool'
import { brushRect, grownBy } from './tiles'
import {
  containIn,
  DEFAULT_VIEW,
  fitTo,
  sameViewport,
  toDocument,
  zoomCanvasAt,
  type CanvasView,
  type Viewport,
} from './viewport'

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
  /** Same, for what a grip does: scale, rotation and place all move together. */
  transform: (id: string, transform: Transform) => void
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
  /** So is the selection: the engine carves it out, React holds it. */
  onSelection: (selection: CanvasSelection) => void
  /** The host's size, which the zoom commands need: they centre on a panel they cannot see. */
  onHost: (size: Size) => void
  /**
   * A caption the hand asked for: a layer already there to edit, or a fresh box to open one in.
   * The layer it becomes, and the editor it opens, are the stack's to make.
   */
  onText: (asked: { layerId: string } | { at: Point; box: Size }) => void
  /** A shape the hand finished drawing, and where its box starts. Same split as `onText`. */
  onShape: (at: Point, drawn: DrawnShape) => void
  /**
   * The frame a crop drag settled on, in document units. Same split as `onText`: the engine
   * knows where the pointer went, the document's history knows what that means.
   */
  onCrop: (rect: Rect) => void
  /**
   * Whether a frame is drawn — not where. It is what a bar needs to offer Accept and Cancel,
   * and ⏎ and ⎋ were the only way to answer one for as long as nobody was told.
   */
  onCropFrame: (framed: boolean) => void
  guides: GuidePort
  layers: LayerPort
  /** Puts an embedded face in the page. Injected because jsdom has no `FontFace` to put it with. */
  addFace: FaceRegistrar
}

/**
 * Declared by the bar, not implemented here. Kept in the union so the registry stays typed, and
 * kept in one place so wiring one is a single deletion.
 *
 * Exported so the bar's registry can be crossed against it: a tool listed here whose button is
 * not greyed arms a gesture `onPointerDown` drops on the floor.
 */
export const UNBUILT_TOOLS: ReadonlySet<CanvasTool> = new Set<CanvasTool>(['comment'])

/**
 * Pixi's own name for each mode. Total on purpose: a mode added to `BlendMode` and forgotten here
 * must be a compile error, not a layer that quietly composites as `normal`.
 *
 * Only `normal`, `multiply` and `screen` are native GL blends; the other twelve come from
 * `pixi.js/advanced-blend-modes`, which `mount` imports.
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

type LayerSurface = {
  texture: RenderTexture
  sprite: Sprite
  /**
   * Whether the document filled this surface itself, which makes it the authority over the
   * layer's `source`.
   *
   * `source` names where a pixel layer CAME FROM, and the engine reloads it when the surface is
   * born. That is right until the document carries the layer's own pixels — and ⌘S is what makes
   * the two diverge: it writes the flattened stack into that very asset, so a reload would fold
   * the whole picture back into the layer it came from and draw the upper layers over it a
   * second time, further at every open.
   *
   * Held on the surface rather than in a set beside it, so it dies with the texture: a layer
   * that comes back on ⌘Z has no pixels left and its asset is the only picture to draw.
   */
  fromDocument: boolean
}

/** Which of a layer's two surfaces the brush writes on. */
export type PaintSurface = 'pixels' | 'mask'

/**
 * One surface's pixels, on their way to a file or back — a PNG, as bytes.
 *
 * Never base64. A 4K stack of ten layers is hundreds of megabytes of text, held at the same
 * instant by the window that encoded it and the process that decodes it — and a data URL of one
 * would be kept for the session by the loader's cache, which is keyed on the whole string.
 */
export type LayerPixels = {
  layerId: string
  /** A layer keeps two surfaces: the picture, and the mask painted over it. */
  mask: boolean
  /**
   * Over an `ArrayBuffer` and not an `ArrayBufferLike`, which is what makes it a `BlobPart`:
   * spelt loosely, restoring a 4K layer copied the whole of it only to narrow the type.
   */
  data: Uint8Array<ArrayBuffer>
}

/**
 * Where a stroke lands, and how to get there. `toSurface` maps the document onto the surface's
 * own pixels: the sprite that shows them carries the layer's transform, so artwork drawn where
 * the cursor is would otherwise be displaced by exactly that transform.
 *
 * Taken once when the gesture opens rather than per move: the layer cannot be transformed while
 * the pointer is captured, and re-deriving it per `pointermove` was also re-resolving the active
 * layer, which a stroke must not do.
 */
type BrushTarget = { key: string; surface: LayerSurface; toSurface: Affine }

/**
 * Which transform a surface is placed by. Unlinked means the mask does not follow the layer: it
 * stays where it was painted. Read by the placement and by the way back into the pixels, which
 * have to agree — a brush that disagrees with the sprite paints beside the cursor.
 */
function surfaceTransform(layer: Layer, mask: boolean): Transform {
  return mask && layer.mask?.linked !== true ? IDENTITY : layer.transform
}

/**
 * A line is a stroke, and the brush size is a diameter: a 24 px brush draws a 6 px line, which is
 * what the same setting gives a dab of ink under a pen.
 */
function strokeWidth(brushSize: number): number {
  return Math.max(1, brushSize / 4)
}

/**
 * How far a text drag has to reach before it counts as one, in document units. Below it the hand
 * meant a click, and a click opens the default box — a caption three pixels wide is nobody's ask.
 */
const MIN_TEXT_DRAG = 8

/** The shape a layer holds, back as geometry — its two points are already in its own space. */
function shapeOf(layer: ShapeLayer): ShapeGeometry {
  return shapeGeometry(layer.shape, layer.from, layer.to, {
    sides: layer.sides,
    constrain: false,
  })
}

/**
 * What a drawn layer's texture was last rasterized from — an unchanged key costs no redraw.
 * `null` for a layer that holds its own pixels, which no state can redraw.
 */
function drawingKey(layer: Layer): string | null {
  if (layer.kind === 'text') {
    return [
      layer.text,
      layer.size,
      layer.color,
      fontKey(layer.font),
      layer.box.width,
      layer.align,
      layer.lineHeight,
      layer.tracking,
    ].join('|')
  }
  if (layer.kind !== 'shape') return null

  return [
    layer.shape,
    layer.from.x,
    layer.from.y,
    layer.to.x,
    layer.to.y,
    layer.sides,
    layer.fill,
    layer.stroke?.color,
    layer.stroke?.width,
  ].join('|')
}

/**
 * A canvas as PNG bytes. Two spellings and no way round it: a window's canvas answers through a
 * callback, a worker's through a promise, and Pixi publishes both as optional.
 */
async function blobOf(canvas: ICanvas): Promise<Blob | null> {
  if (canvas.convertToBlob) return await canvas.convertToBlob({ type: 'image/png' })
  const { toBlob } = canvas
  if (!toBlob) return null
  return await new Promise(resolve => {
    toBlob.call(canvas, resolve, 'image/png')
  })
}

/** A grading pass: the container the filter runs over, and the filter itself. */
type AdjustPass = Container & { filter: AdjustFilter }

/** The stencil that cuts a clipped layer out of the one below it, and what holds the pair. */
type ClipProxy = { baseId: string; sprite: Sprite; host: Container }

/** What the pointer is doing, if anything: the gestures are exclusive by construction. */
type Gesture =
  | { kind: 'none' }
  | { kind: 'pan'; from: Point }
  | { kind: 'guide'; id: string; axis: Axis }
  | { kind: 'paint'; from: Point; target: BrushTarget }
  /** `origin` is where the layer stood when the drag began: every step is absolute from it. */
  | { kind: 'move'; id: string; from: Point; origin: Point }
  | { kind: 'select'; from: Point }
  /** Drawing a fresh crop frame from `from`; the frame itself lives on past the drag. */
  | { kind: 'crop'; from: Point }
  /** Pulling one grip of the placed crop frame. `origin` is the frame the drag started on. */
  | { kind: 'cropHandle'; handle: HandleId; origin: Rect }
  /**
   * The drag's two points, in document units. `to` is held rather than derived on release: it is
   * the point AFTER shift has been applied, and the layer must store the square that was drawn.
   */
  | { kind: 'shape'; from: Point; to: Point }
  /** Sizing a caption's box by its diagonal. A drag of nothing at all is a click, which opens one. */
  | { kind: 'text'; from: Point; to: Point }
  /** `origin` is the transform the layer had when the drag began: every step is absolute. */
  | { kind: 'handle'; id: string; handle: HandleId; from: Point; origin: Transform }
  /** Turning by the zone outside a corner. `center` is the middle the layer pivots about. */
  | { kind: 'rotate'; id: string; center: Point; from: Point; origin: Transform }

const NO_GESTURE: Gesture = { kind: 'none' }

/**
 * The tools that lay a disc down where the hand is, and so the ones the ring stands for. The
 * fill floods a region rather than stamping one, and the shapes are drawn corner to corner:
 * neither says anything about the brush's footprint.
 */
const RINGED_TOOLS: ReadonlySet<CanvasTool> = new Set(['brush', 'pencil', 'eraser'])

/**
 * The tools that write on the armed layer's surface, and so the ones a layer can refuse. The
 * text tool is not one: it places a caption of its own rather than writing on what is armed.
 * The eyedropper reads, and the selection tools carve out a region rather than a layer.
 */
const WRITING_TOOLS: ReadonlySet<CanvasTool> = new Set([
  'brush',
  'pencil',
  'eraser',
  'fill',
  'shape',
])

/** Which gestures hold a layer open in the history, so releasing one closes its entry. */
const LAYER_DRAGS: ReadonlySet<Gesture['kind']> = new Set(['move', 'handle', 'rotate'])

/** Both arms carry `id`, so two hovers compare without pairing their kinds again. */
function sameHit(one: HandleHit | null, other: HandleHit | null): boolean {
  if (!one || !other) return one === other
  return one.kind === other.kind && one.id === other.id
}

/** What a hover or a press may take hold of, and how the cursor over it should be turned. */
type HoverBox = { corners: Corners; reach: number; facing: Facing }

/**
 * The layer's own rotation and mirroring turn the arrow, never the geometry of the box: a grip
 * pulls along its nominal direction, and the box's proportions have nothing to say about it.
 */
function cursorFor(hit: HandleHit, facing: Facing): string {
  return hit.kind === 'rotate' ? rotateCursor(hit.id, facing) : resizeCursor(hit.id, facing)
}

/** Where a surface's picture starts when nothing displaced it — see `resurface`. */
const ORIGIN: Point = { x: 0, y: 0 }

/** Which token each part of the overlay is painted with. The values live in `index.css`. */
export const OVERLAY_TOKENS: Record<keyof OverlayColors, string> = {
  frame: '--color-border',
  guide: '--color-accent-soft',
  // A step above the chassis, not level with it: the bands sit on the darkest surface of the
  // studio, and at chassis they read as a continuation of it rather than as a scale to measure
  // against. The ticks come up with the background — `border` on `elevated` is barely a shade
  // apart, and graduations nobody can see are the same as no rulers at all.
  rulerBackground: '--color-elevated',
  rulerText: '--color-muted',
  rulerTick: '--color-muted',
  accent: '--color-accent',
  marqueeLight: '--color-marquee-light',
  marqueeDark: '--color-marquee-dark',
  scrim: '--color-scrim',
}

/**
 * Legible on the studio's greys, and only ever used before a canvas exists to read from.
 *
 * Every value restates its token's DARK declaration, and a test pins the pair: `token()` answers
 * empty for a name `index.css` no longer declares, so a renamed token would quietly make this
 * table the real source of the overlay's colours instead of its last resort.
 */
export const FALLBACK_COLORS: OverlayColors = {
  frame: '#34363a',
  guide: 'rgba(52, 110, 242, 0.55)',
  rulerBackground: '#3c3f44',
  rulerText: '#91959b',
  rulerTick: '#91959b',
  accent: '#346ef2',
  marqueeLight: '#ffffff',
  marqueeDark: '#000000',
  scrim: '#00000099',
}

const RULER_FAMILY = 'system-ui, sans-serif'

/** `--text-micro` at scale 1, for a canvas not yet in a document — as `FALLBACK_COLORS` is. */
const RULER_FONT_SIZE = '9px'
const FALLBACK_RULER_FONT = `${RULER_FONT_SIZE} ${RULER_FAMILY}`

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
    marqueeLight: read('marqueeLight'),
    marqueeDark: read('marqueeDark'),
    scrim: read('scrim'),
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
  /**
   * Where the picture actually landed inside each layer's surface — what `containIn` worked out
   * when it was drawn, kept so the handles can grip the photo rather than the document.
   *
   * Derived, never stored: `loadInto` fills it from `layer.source` on every mount, every undo and
   * every detach, so a document rebuilt from its manifest arrives with the same answer. Invariant
   * 3 holds — nothing here is a fact the state does not already carry.
   */
  private readonly contents = new Map<string, Rect>()
  /** Families already asked of the page, whether they arrived or not — see `registerFace`. */
  private readonly faces = new Set<string>()
  private readonly groups = new Map<string, Container>()
  /** One per clipped layer, keyed by it: a run of three on one base takes three proxies. */
  private readonly clips = new Map<string, ClipProxy>()
  /** Built on the first isolated group, and only then: most documents never hold one. */
  private isolation: AlphaFilter | null = null
  /**
   * The stencil pass in flight, and the stencil it owns. Held as the pair because they are not
   * the same thing to free: the holder's other children are borrowed — the brush's stamp lives
   * as long as the engine, a tool's drawing is freed by the tool — and only the stencil is the
   * pass's own.
   */
  private clipping: { holder: Container; stencil: Graphics } | null = null
  /** One grading pass per adjustment layer, holding the filter it applies. */
  private readonly adjustments = new Map<string, AdjustPass>()
  /** What each drawn layer — a caption, a shape — was last rasterized from, so a redraw is rare. */
  private readonly drawings = new Map<string, string>()
  /** Regions asked of masks that did not exist yet — see `fillMaskFromSelection`. */
  private readonly pendingMaskFills = new Map<string, readonly Point[]>()
  /** Pictures composed for layers that do not exist yet — see `flattenInto`. */
  private readonly pendingPictures = new Map<string, RenderTexture>()
  /**
   * Saved pixels waiting for the surface they belong to. The document layer writes the stack into
   * the store, and the engine only hears about it a React commit later — so a picture read off the
   * disk almost always arrives before the layer it fills.
   */
  private readonly pendingSnapshots = new Map<string, Uint8Array<ArrayBuffer>>()
  private readonly stamp = new Graphics()
  /**
   * What softens the edge of a dab. One instance, tuned when the brush changes and never per
   * dab: a filter rebuilt inside a `pointermove` would recompile a shader hundreds of times
   * across one stroke.
   */
  private readonly softener = new BlurFilter({ strength: 0, quality: 2 })
  /** The spread currently hung on the stamp, in document pixels. `dab` reads it rather than
   * asking again: the number that sets the filter and the number that sizes the undo box are
   * the same number, and two callers of one formula are two chances to disagree. */
  private spread = 0
  /** Carries the map back into a surface's own pixels — see `inSurfaceSpace`. */
  private readonly paintSpace = new Container()
  private readonly paintMatrix = new Matrix()
  private readonly overlay = new CanvasOverlay(() => this.scene())
  /** Built with the renderer, in `mount`: a tile is a texture, and there is none before then. */
  private patches: PixelPatches | null = null
  private resizer: ResizeObserver | null = null
  private stopPaletteWatch: (() => void) | null = null

  /** The pointer, so a click before React has armed anything cannot write on the picture. */
  private tool: CanvasTool = 'move'
  private painting: PaintSurface = 'pixels'
  private brush: BrushSettings = DEFAULT_BRUSH
  private state: CanvasState | null = null
  private view: CanvasView = DEFAULT_VIEW
  private hostSize: Size = { width: 0, height: 0 }
  private colors: OverlayColors = FALLBACK_COLORS
  private rulerFont = FALLBACK_RULER_FONT

  /** What the graduations are written in. `undefined` is the host's locale; `''` would throw. */
  private language: string | undefined
  /** Read on resize rather than per event: `getBoundingClientRect` forces a layout. */
  private bounds: DOMRect | null = null

  /** The tree's shape, as `placement` spells it: what tells a restack apart from a repaint. */
  private stacking = ''

  private gesture: Gesture = NO_GESTURE
  private hover: HandleHit | null = null
  /** Whether the armed tool is currently saying it can do nothing here — see `refuses`. */
  private refused = false
  /**
   * The last refusal, and what it was computed from. Memoised for the same reason `corners` is:
   * answering it walks the layer tree and inverts a matrix, and `hovering` runs per pointer move.
   */
  private refusal: {
    of: CanvasState | null
    tool: CanvasTool
    painting: PaintSurface
    value: boolean
  } | null = null
  /**
   * The armed layer's corners, derived once per state. Reaching a layer flattens the whole tree,
   * and both the hover test and the overlay frame want the same answer on the same pointer move.
   *
   * Keyed on the state's identity, as `apply` keys its own work: `apply` replaces it wholesale,
   * so the document's size and the armed id ride along with the tree.
   */
  private corners: { of: CanvasState | null; box: Corners | null } = { of: null, box: null }
  private pointer: Point | null = null
  private selection: CanvasSelection = null
  /** Which of the three the region tool draws. Pushed in by the bar, like the tool itself. */
  private selectionShape: SelectionShape = 'rect'
  private shapeKind: ShapeKind = 'rectangle'
  private shapeSides = 5
  /** The shape being dragged, drawn in the overlay until the hand comes up. */
  private pending: ShapeGeometry | null = null
  /** The box a text drag is sizing, framed in the overlay until the hand comes up. */
  private textBox: Rect | null = null
  /** The caption a field is typing: drawn by that field, so its own sprite stands aside. */
  private editing: string | null = null
  /**
   * The crop frame, once placed. Outlives its drag on purpose — that is what makes the grips
   * real, and what ⏎ applies and ⎋ drops. Session state, like the selection: a frame nobody
   * committed is not something ⌘Z should have to know about.
   */
  private cropping: Rect | null = null
  /** Wrapped, so a pending `null` is told apart from nothing pending — see `publishSelection`. */
  private publishingSelection: { selection: CanvasSelection } | null = null
  private selectionFrame = 0
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

    // Above the guard below on purpose: arming another layer keeps `layers` identical, so this
    // is the one path a box can move under a still pointer without the tree changing at all.
    if (previous !== state) this.forgetHover()

    // Dragging a guide rewrites the state sixty times a second and touches no pixel: walking the
    // tree and re-rendering the stage for it would be a full GPU frame per pointer move.
    if (previous && previous.layers === state.layers && !resized) return

    // A frame is placed against a document that no longer exists: a quarter turn or a resample
    // under it would leave ⏎ cropping to a rectangle outside the picture, which recuts every
    // surface to nothing and throws the undo tiles away with them.
    if (resized) this.dropCrop()

    // Before `reconcile`, which builds what is missing at the size the state now names: a
    // surface that survives has to reach the same size, or half the stack is one document old.
    if (previous && resized) this.resurface(state)

    this.reconcile()
    if (resized && this.framed) this.frameDocument()
    this.render()
  }

  /**
   * Rebuilds every surface at the document's new size, masks included, and copies the old picture
   * into it. Until this existed a texture was allocated once, at whatever size the document had
   * when the layer was born, and never grew: a quarter turn left the layers outside the frame,
   * and merging or flattening had nowhere document-sized to compose into.
   *
   * `from` is the corner the kept picture starts at. A crop moves it; a resample or a quarter
   * turn leaves it at the origin. It has to be carried here rather than through the layer
   * transforms: a surface is document-sized, so the new one only has room for the kept region,
   * and a copy landing at the origin would keep the document's top-left corner instead — the
   * frame would then come out empty wherever `from` pushed past the new width.
   *
   * A surface already at that size is left alone: the crop recuts the pixels before the command
   * that reports the new frame, and the `apply` that follows must not undo its work.
   *
   * Shrinking loses what falls outside, and the undo tiles go with it: the frame comes back on
   * ⌘Z, the pixels it cut away do not.
   */
  private resurface(size: Size, from: Point = ORIGIN): void {
    const renderer = this.app?.renderer
    if (!renderer || this.surfaces.size === 0) return

    let recut = false
    for (const surface of this.surfaces.values()) {
      if (surface.texture.width === size.width && surface.texture.height === size.height) continue
      recut = true

      const texture = RenderTexture.create({
        width: size.width,
        height: size.height,
        resolution: 1,
      })

      const carried = new Sprite(surface.texture)
      carried.position.set(-from.x, -from.y)
      renderer.render({ container: carried, target: texture, clear: true })
      // The old texture is destroyed just below, so its source must not go with the sprite.
      carried.destroy({ texture: false, textureSource: false })

      surface.sprite.texture = texture
      surface.texture.destroy(true)
      surface.texture = texture
    }

    // The pixels were carried over translated by `-from`, and nothing re-runs `loadInto` here —
    // so the remembered picture rects have to travel the same distance. Left where they were, a
    // crop would leave every picture layer's grips at the coordinates the OLD document used.
    if (recut) {
      for (const [id, laid] of this.contents) {
        this.contents.set(id, { ...laid, x: laid.x - from.x, y: laid.y - from.y })
      }
      this.patches?.dropAll()
    }
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
      else if (layer.kind === 'adjustment') this.syncAdjustment(layer)
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
      this.contents.delete(id)
    }

    for (const [id, container] of this.groups) {
      if (kept.has(id)) continue
      // Emptied first, and destroyed without `children`: ungrouping keeps the layers, and
      // taking their sprites down with the container is the same lost-pixels bug in reverse.
      container.removeChildren()
      container.destroy()
      this.groups.delete(id)
    }

    for (const [id, pass] of this.adjustments) {
      if (kept.has(id)) continue
      // Emptied first: what it graded are layers that live on without it.
      pass.removeChildren()
      pass.destroy()
      this.adjustments.delete(id)
    }

    for (const id of this.drawings.keys()) {
      // Its texture went with it, so the words have to be drawn again on the way back.
      if (!kept.has(id)) this.drawings.delete(id)
    }

    const clipping = new Set(layers.filter(layer => layer.clipped).map(layer => layer.id))
    for (const [id, clip] of this.clips) {
      if (clipping.has(id) && this.surfaces.has(clip.baseId)) continue
      this.destroyClip(clip)
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

      if (node.kind === 'adjust') {
        const pass = this.adjustments.get(node.id)
        if (!pass) continue
        // What it covers goes inside it: the filter grades the pass, not a sibling beside it.
        this.attach(node.children, pass)
        parent.addChild(pass)
        continue
      }

      const surface = this.surfaces.get(node.id)
      if (!surface) continue

      // A clipped layer hangs in a container of its own: an object carries one mask, and a
      // clipped layer that also has a mask of its own needs two.
      const clip = node.clippedBy === null ? null : this.clipProxy(node.id, node.clippedBy)
      const holder = clip ?? parent

      const mask =
        node.maskedBy === null || !node.maskEnabled
          ? null
          : (this.surfaces.get(maskKey(node.maskedBy)) ?? null)
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
      if (clip) this.destroyClip(clip)
      // The base is already being drawn: an object cannot be both the picture and the stencil,
      // so the proxy shares its texture and nothing else. Three clipped layers on one base take
      // three proxies, and all three stay visible.
      const sprite = new Sprite(base.texture)
      const host = new Container()
      // On the alpha, not on the default red channel: what cuts a clipped layer out is where the
      // base has pixels, not how red they are. A base painted pure blue would cut out nothing.
      host.setMask({ mask: sprite, channel: 'alpha' })
      clip = { baseId, sprite, host }
      this.clips.set(layerId, clip)
    }

    clip.host.removeChildren()
    clip.host.addChild(clip.sprite)
    return clip.host
  }

  private destroyClip(clip: ClipProxy): void {
    clip.host.removeChildren()
    // Cleared first: `destroy` drops the effect without handing it back to Pixi's pool.
    clip.host.mask = null
    clip.host.destroy()
    // Without its texture: the proxy is the one sprite that borrows another layer's.
    clip.sprite.destroy()
  }

  /** The proxies follow their base: a stencil a frame behind the layer it cuts would show a seam. */
  private refreshClips(): void {
    const state = this.state
    if (!state) return

    for (const clip of this.clips.values()) {
      const base = this.surfaces.get(clip.baseId)
      const layer = layerById(state, clip.baseId)
      if (!base || !layer) continue

      // From the state, through the one placement path the engine has: a second one would drift.
      this.place(clip.sprite, layer.transform, base.texture)
      // A stencil is only as strong as the base it stands for: hiding the base has to hide what
      // is clipped to it, and fading the base has to fade it.
      clip.sprite.visible = layer.visible
      clip.sprite.alpha = layer.opacity * layer.fillOpacity
    }
  }

  /**
   * The grading pass of one adjustment layer. It holds no texture and no sprite: what it owns is
   * a container carrying a filter, and what the filter grades is whatever `attach` puts in it.
   */
  private syncAdjustment(layer: AdjustmentLayer): void {
    let pass = this.adjustments.get(layer.id)
    if (!pass) {
      const filter = createAdjustFilter()
      pass = Object.assign(new Container({ label: layer.id }), { filter })
      pass.filters = [filter]
      this.adjustments.set(layer.id, pass)
    }

    // Never `visible` or `alpha` on the container: it holds the layers it grades, so hiding it
    // would hide the whole stack under it. Hiding a grading is dropping its pass.
    pass.filters = layer.visible ? [pass.filter] : []
    pass.filter.grade(layer.values)
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
    // A group composites on itself before the stack sees it, which is what an offscreen pass
    // does — and a neutral filter is the only way v8 offers to ask for one. Without it a
    // container's `blendMode` is merely inherited, and every child overwrites it with its own;
    // its `alpha` multiplies per child, so two overlapping layers show through each other.
    //
    // Only where it would show, because the pass costs a render target per group.
    const composed = layer.isolation === 'isolate' || layer.blend !== 'normal' || layer.opacity < 1
    // Written only when it turns: Pixi copies and freezes the array on every assignment, and
    // this runs for every group of the document on every state it is handed.
    if (composed !== (container.filters ?? []).length > 0) {
      container.filters = composed ? [this.isolationPass()] : []
    }
    // A group holds no texture, so the document is the box its origin is a fraction of.
    this.place(container, layer.transform, box)
  }

  private isolationPass(): AlphaFilter {
    // One per engine, shared by every isolated group: a filter carries no per-object state.
    this.isolation ??= new AlphaFilter()
    return this.isolation
  }

  /**
   * Draws a picture into a layer's texture, laid inside the document without deforming it.
   *
   * `url` is a `scenario://asset/<id>`: the renderer has no filesystem, and the main process
   * serves the scheme against the catalogue.
   */
  async loadInto(layerId: string, url: string, clear = false): Promise<void> {
    const mounting = this.mounting
    const surface = this.surfaces.get(layerId)
    if (!surface || !this.app || !this.state) return

    // The scheme carries no extension, so nothing in the URL tells Pixi what to make of it.
    const texture = await Assets.load({ src: url, parser: 'texture' })
    // Read after the await: the document can be closed, or the layer removed and rebuilt, while
    // it is in flight. Compared by identity rather than by key — an undo and a redo put a fresh
    // surface under the same id, and the one captured above has had its texture destroyed.
    if (mounting !== this.mounting || this.surfaces.get(layerId) !== surface) return

    const renderer = this.app?.renderer
    if (!renderer || !this.state) return

    const laid = containIn(texture, { width: this.state.width, height: this.state.height })
    // Remembered here because here is where it is known: the handles need the rect the picture
    // occupies, and nothing else in the engine ever works it out.
    this.contents.set(layerId, laid)
    const sprite = new Sprite(texture)
    sprite.position.set(laid.x, laid.y)
    sprite.setSize(laid.width, laid.height)

    renderer.render({ container: sprite, target: surface.texture, clear })
    // Its texture belongs to the asset cache, and another layer may hold the same picture.
    sprite.destroy()
    this.render()
  }

  /**
   * Drops a rewritten picture from the loader's cache, so the next layer placed from that asset
   * draws what is on disk now.
   *
   * The cache is keyed on the URL and lives for the session, so ⌘S over an asset would otherwise
   * be invisible to every OTHER document that places it — the loader answers from memory and
   * never asks the scheme again.
   *
   * `unload` frees the GPU texture as well, so it must not run while something still draws from
   * it. Nothing here does: `loadInto` renders it into the layer's own surface and destroys the
   * sprite in the same breath. Skipped when the loader never held it — unloading a URL it does
   * not know is not something to make a caller think about.
   */
  async forgetPicture(assetId: string): Promise<void> {
    const url = assetUrl(assetId)
    if (Assets.get(url) === undefined) return
    await Assets.unload(url)
  }

  /**
   * What the rulers are graduated in. Pushed like the view rather than read off
   * `documentElement.lang`: that attribute is a projection written for screen readers, and it
   * carries no notification — the rulers would keep the language they were mounted in while the
   * inspector beside them changed.
   */
  setLanguage(language: string): void {
    if (language === this.language) return
    this.language = language
    this.overlay.invalidate()
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
    // A zoom slides the grips out from under a still hand. Not while a gesture is open: that one
    // owns the cursor — a pan holds `grabbing` across every frame it moves the view by.
    if (this.gesture.kind === 'none') this.forgetHover()
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
    // A frame belongs to the tool that placed it: leaving it up under the brush would keep ⏎
    // bound to a crop nothing on screen still explains.
    if (tool !== 'crop') this.dropCrop()
    this.tool = tool
    this.tuneSoftener()
    // The pencil and the brush read the same settings and spread them differently: switching
    // between them changes the edge with nothing else moving.
    // The chrome belongs to the tool that draws it: without this the move tool's grips stayed on
    // screen under the brush until something else happened to invalidate.
    this.forgetHover()
  }

  /**
   * Drops what the pointer was over, and repaints without it.
   *
   * Called wherever the box may have moved out from under a still hand — a tool change, the end
   * of a drag, a zoom, a fresh state. The hover is recomputed on the next move rather than
   * guessed at from before: a lit grip that no longer sits under the pointer is worse than none.
   */
  private forgetHover(): void {
    // The refusal is dropped alongside the grip: a refusing tool holds no chrome, so a guard on
    // the grip alone left `not-allowed` on screen after arming a tool that refuses nothing.
    if (!this.hover && !this.refused) return
    this.hover = null
    this.refused = false
    // Never over a cursor something else owns: a gesture holds its own for as long as it runs —
    // a pan keeps `grabbing` across every frame it moves the view by — and space held is a pan
    // in waiting that `releaseSpace` will give back.
    if (this.gesture.kind === 'none' && !this.spacing) this.setCursor('')
    this.overlay.invalidate()
  }

  setBrush(settings: BrushSettings): void {
    this.brush = settings
    this.tuneSoftener()
    // The ring is drawn from this size: without a repaint it would keep the old footprint until
    // the hand next moved, and a size slider would look disconnected from what it sets.
    if (this.ringed()) this.overlay.invalidate()
  }

  /**
   * How far the edge of a dab is spread, in document pixels — zero for every tool that does not
   * feather.
   *
   * **Which ones those are is `BRUSH_SETTINGS_BY_TOOL`, asked rather than restated.** The bar
   * hides the hardness slider from the same table, so the two cannot drift into a control that
   * moves nothing.
   *
   * The pencil is hard by definition, and that is the whole of what tells it from the brush. The
   * eraser is hard for a reason of Pixi's: a filtered container is drawn into a texture of its
   * own, cleared to nothing, and composed back with the FILTER's blend mode rather than the
   * stamp's — so an `erase` stamp under a filter rubs out against an empty texture and takes
   * nothing away. Softening it would mean moving the blend onto the filter, which no test here
   * can check: there is no GPU under vitest, and this is the one path where being wrong means
   * the eraser silently stops erasing.
   */
  private softness(): number {
    return readsBrushSetting(this.tool, 'hardness') ? blurRadius(this.brush) : 0
  }

  /**
   * How far the softened edge reaches past the disc, in SURFACE pixels — which is the space a
   * filter works in. Zero when nothing is hung, so a hard brush records the box it always did.
   */
  private fringe(): number {
    return this.spread === 0 ? 0 : this.softener.padding
  }

  /**
   * The filter is hung on the stamp only while it has something to do. Left in place at zero
   * strength it would still cost a render pass and a framebuffer bind on every dab of a hard
   * brush, which is the common case.
   */
  private tuneSoftener(): void {
    const spread = this.softness()
    if (spread === this.spread) return

    this.spread = spread
    if (spread === 0) {
      this.stamp.filters = []
      return
    }

    this.softener.strength = spread
    // Rounded up, and that is what this line is for: Pixi computes the same `strength * 2` and
    // then applies it as `(padding | 0)`, so a fractional spread would lose its last pixel of
    // fringe. Written after `strength`, whose setter recomputes padding from scratch.
    this.softener.padding = Math.ceil(spread * 2)
    this.stamp.filters = [this.softener]
  }

  /** Whether the armed tool stamps a disc, and so whether the ring stands for anything. */
  private ringed(): boolean {
    return RINGED_TOOLS.has(this.tool)
  }

  /**
   * Fills a layer's mask with the selection: what is inside stays visible, everything else is
   * hidden. The mask and the inpainting mask are the same object, so this is also how a region
   * becomes something to regenerate.
   *
   * The layer must already carry a mask — the command that gives it one runs on the React side,
   * and the surface follows on the next `apply`.
   */
  fillMaskFromSelection(layerId: string): void {
    const renderer = this.app?.renderer
    const mask = this.surfaces.get(maskKey(layerId))
    const outline = selectionOutline(this.selection)
    const first = outline[0]
    if (!first || !renderer || !this.state) return

    if (!mask) {
      // The command that gives the layer its mask has only just been run: the surface follows
      // on the next `apply`, one React commit later. Held until then rather than dropped.
      this.pendingMaskFills.set(layerId, outline)
      return
    }

    this.paintMask(layerId, mask, outline)
  }

  /**
   * Composes the whole stack into one picture and holds it for the layer that is about to replace
   * it. Called BEFORE `flatten` runs: once the command has run the stack is gone, and with it
   * every texture the picture is made of.
   *
   * The layer it is held for does not exist yet — the command that creates it runs on the React
   * side, and its surface follows on the next `apply`. Same shape as `fillMaskFromSelection`.
   */
  flattenInto(layerId: string): void {
    const renderer = this.app?.renderer
    if (!renderer || !this.state) return

    const picture = RenderTexture.create({
      width: this.state.width,
      height: this.state.height,
      resolution: 1,
    })

    // The world carries pan and zoom, which are session state and have no business in a picture:
    // flattening at 40 % would otherwise bake a document four fifths empty.
    const { x, y } = this.world.position
    const scale = this.world.scale.x
    this.world.position.set(0, 0)
    this.world.scale.set(1)
    renderer.render({ container: this.world, target: picture, clear: true })
    this.world.position.set(x, y)
    this.world.scale.set(scale)

    this.dropPending(layerId)
    this.pendingPictures.set(layerId, picture)
  }

  /**
   * Draws one layer's pixels into the one below it, before `mergeDown` drops it from the stack.
   * The lower layer keeps its own texture — that is what the command records — so this is the
   * only moment the upper one's pixels can be saved.
   *
   * Both surfaces already exist, so nothing is held back: the picture is composed straight away.
   * The upper layer is carried through the document and back into the lower layer's own pixels,
   * which is what makes a merge right when either of them has been moved or turned.
   */
  mergeInto(belowId: string, aboveId: string): void {
    const renderer = this.app?.renderer
    const state = this.state
    const below = this.surfaces.get(belowId)
    const above = this.surfaces.get(aboveId)
    if (!renderer || !state || !below || !above) return

    const aboveLayer = layerById(state, aboveId)
    const belowLayer = layerById(state, belowId)
    if (!aboveLayer || !belowLayer) return

    const toBelow = invert(this.surfaceMatrix(belowLayer, false, below))
    if (!toBelow) return

    const carried = new Sprite(above.texture)
    // What the eye saw of the upper layer, which is what a merge promises to keep.
    carried.alpha = aboveLayer.opacity * aboveLayer.fillOpacity
    carried.blendMode = BLEND_BY_MODE[aboveLayer.blend]

    const placement = compose(toBelow, this.surfaceMatrix(aboveLayer, false, above))
    renderer.render({
      container: this.inSurfaceSpace(placement, carried),
      target: below.texture,
      clear: false,
    })
    carried.destroy({ texture: false, textureSource: false })
    this.render()
  }

  /** A picture held for a layer that never arrived, or that is being replaced by a newer one. */
  private dropPending(layerId: string): void {
    const held = this.pendingPictures.get(layerId)
    if (!held) return
    this.pendingPictures.delete(layerId)
    held.destroy(true)
  }

  /** Pours the picture held for a layer into the surface it was waiting for. */
  private drainPendingPicture(layerId: string, surface: LayerSurface): void {
    const renderer = this.app?.renderer
    const picture = this.pendingPictures.get(layerId)
    if (!renderer || !picture) return

    this.pendingPictures.delete(layerId)
    const carried = new Sprite(picture)
    renderer.render({ container: carried, target: surface.texture, clear: true })
    carried.destroy({ texture: false, textureSource: false })
    picture.destroy(true)
    this.render()
  }

  private paintMask(layerId: string, mask: LayerSurface, outline: readonly Point[]): void {
    const renderer = this.app?.renderer
    const layer = this.state && layerById(this.state, layerId)
    const first = outline[0]
    if (!renderer || !first || !layer || !this.state) return

    // The outline is where the marquee was drawn, in the document; the mask's pixels are its own.
    // Without the way back, a mask made from a selection on a moved layer hides the wrong region.
    const toSurface = invert(this.surfaceMatrix(layer, true, mask))
    if (!toSurface) return

    const sheet = new Graphics()
    // Black over the whole document, then the region in white: the mask reads its red channel,
    // so black hides and white reveals, exactly as painting into it by hand does.
    sheet.rect(0, 0, this.state.width, this.state.height)
    sheet.fill({ color: 0x000000 })
    sheet.moveTo(first.x, first.y)
    for (const point of outline.slice(1)) sheet.lineTo(point.x, point.y)
    sheet.fill({ color: WHITE })

    renderer.render({
      container: this.inSurfaceSpace(toSurface, sheet),
      target: mask.texture,
      clear: true,
    })
    sheet.destroy()
    this.render()
  }

  /**
   * A mask that has just come into existence takes the region it was asked for. Kept as the
   * outline rather than as "the current selection": what a click meant must not change because
   * the pointer moved between the command and the frame that built the surface.
   */
  private drainPendingMask(layerId: string, mask: LayerSurface): void {
    const outline = this.pendingMaskFills.get(layerId)
    if (!outline) return

    this.pendingMaskFills.delete(layerId)
    this.paintMask(layerId, mask, outline)
  }

  /**
   * The whole document as one picture, or a region of it — the flatten `mergedimage.png` holds,
   * and what every other application draws of a `.ora`.
   *
   * Extracted rather than composited by hand: the world IS the composited tree, and the GPU has
   * it. Through a canvas and a blob rather than a data URL, so the bytes are never a string.
   */
  async flatten(region?: Rect): Promise<Uint8Array<ArrayBuffer> | null> {
    const frame = region ?? this.documentRect()
    if (!frame || !this.state) return null

    return await this.pngOf(this.world, new Rectangle(frame.x, frame.y, frame.width, frame.height))
  }

  /**
   * The same picture as base64. What an edit sends to the API, which takes the payload alone —
   * a `data:image/png;base64,` reaching it is part of the picture.
   */
  async snapshot(region?: Rect): Promise<string | null> {
    const png = await this.flatten(region)
    return png && bytesToBase64(png)
  }

  /**
   * A target rendered to PNG bytes.
   *
   * `resolution: 1` and never the renderer's, which is the display scale: the same document
   * would otherwise be extracted at 1024² from one screen and 2048² from another.
   */
  private async pngOf(
    target: Container | Texture,
    frame?: Rectangle,
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const renderer = this.app?.renderer
    // `null` for an engine that is not up yet, which every caller already treats as "not ready".
    if (!renderer) return null

    const canvas = renderer.extract.canvas({
      target,
      ...(frame ? { frame } : {}),
      resolution: 1,
    })
    const blob = await blobOf(canvas)
    /**
     * THROWS rather than answering nothing, and the difference is a document.
     *
     * `extract.base64` rejected here, so a surface that would not encode failed the whole ⌘S and
     * left the tab dirty. Answering `null` instead, the save wrote the container WITHOUT that
     * surface — the container is replaced whole — and then marked the document clean. A layer
     * gone, silently, on a save that looked like it worked.
     */
    if (!blob) throw new Error('the renderer would not encode this surface')
    return new Uint8Array(await blob.arrayBuffer())
  }

  /**
   * A layer's mask, alone, as the API wants it: white where the model may paint. It is the same
   * texture the brush writes into — the mask one paints is the mask one regenerates.
   */
  async maskSnapshot(layerId: string): Promise<string | null> {
    const mask = this.surfaces.get(maskKey(layerId))
    const frame = this.documentRect()
    if (!mask || !frame) return null

    // Framed on the document like the picture it masks: extracting the sprite bare would drop
    // the transform `place` put on it, and the mask would arrive offset from what it masks.
    const png = await this.pngOf(
      mask.sprite,
      new Rectangle(frame.x, frame.y, frame.width, frame.height),
    )
    return png && bytesToBase64(png)
  }

  /**
   * Every surface's pixels, for saving the document. The textures rather than the sprites: a
   * surface is document-sized and the transform lives in the state, so extracting a placed
   * sprite would bake in a move `place` applies again on the way back.
   *
   * Keyed by layer rather than by file name — what these are called on disk is the document
   * layer's business, not the engine's.
   */
  async pixelSnapshots(): Promise<LayerPixels[]> {
    if (!this.app?.renderer || !this.state) return []

    const taken: LayerPixels[] = []
    for (const layer of allLayers(this.state.layers)) {
      for (const mask of [false, true]) {
        const surface = this.surfaces.get(mask ? maskKey(layer.id) : layer.id)
        if (!surface) continue
        const data = await this.pngOf(surface.texture)
        // A surface the engine HAS and cannot hand over is a loss, not an absence — the engine
        // going down mid-loop is the ordinary way here. Skipping it wrote the container without
        // that layer and called the save a success.
        if (!data) throw new Error(`Layer ${layer.id} has a surface this engine can no longer read`)
        taken.push({ layerId: layer.id, mask, data })
      }
    }
    return taken
  }

  /**
   * Draws saved pixels back into a layer's surface. Through `loadInto`, which contains what it
   * is given inside the document — a `.png` edited by hand to another size is put back framed
   * rather than spilling over the layers under it.
   */
  async restoreSnapshot(pixels: LayerPixels): Promise<void> {
    const key = pixels.mask ? maskKey(pixels.layerId) : pixels.layerId
    const surface = this.surfaces.get(key)

    // Held rather than dropped when the surface is not there yet: `loadInto` returns in silence
    // on a missing one, and a document would reopen with its stack and none of its pixels. The
    // claim below is then made by the drain, which runs before the surface can reload `source`.
    if (!surface) {
      this.pendingSnapshots.set(key, pixels.data)
      return
    }
    // Marked before the await, so a reload of `source` in flight cannot slip in front of it.
    surface.fromDocument = true
    try {
      await this.loadPixelsInto(key, pixels.data)
    } catch (error) {
      // Given back, and the asset drawn in its place — see `fallBackToSource`.
      this.fallBackToSource(key, surface)
      throw error
    }
  }

  /**
   * Saved pixels into a surface, through a blob URL the loader forgets afterwards.
   *
   * The cache is keyed on the WHOLE source string, so a data URL of a 4K layer would be held for
   * the life of the window — the very megabytes this stopped putting in a string. `unload` and
   * `revokeObjectURL` give the BYTES back; Pixi's resolver keeps its own entry per URL string,
   * which nothing public clears — a few hundred bytes per surface restored, for the session.
   *
   * Cleared, unlike a placed picture: the surface was born filled — white, for the base layer —
   * and compositing over that would bring a hole the user erased back as white rather than as
   * the transparency the file holds.
   */
  private async loadPixelsInto(key: string, png: Uint8Array<ArrayBuffer>): Promise<void> {
    const url = URL.createObjectURL(new Blob([png], { type: 'image/png' }))
    try {
      await this.loadInto(key, url, true)
    } finally {
      await Assets.unload(url).catch(() => undefined)
      URL.revokeObjectURL(url)
    }
  }

  /** Pours the saved pixels held for a surface into it, once it exists. */
  private drainPendingSnapshot(key: string, surface: LayerSurface): void {
    const png = this.pendingSnapshots.get(key)
    if (!png) return
    this.pendingSnapshots.delete(key)
    // Claimed BEFORE the load, because the guard in `syncLayer` reads it on the very next line:
    // set on success it would always be too late, and the asset would be drawn over these pixels
    // every time. Given back below if the load turns out not to arrive.
    surface.fromDocument = true
    // Nothing is rethrown: this runs inside `reconcile`, which has nowhere to report to.
    void this.loadPixelsInto(key, png).catch(() => this.fallBackToSource(key, surface))
  }

  /**
   * Draws the asset a layer names, after its own saved pixels failed to.
   *
   * A surface inside the container can be truncated or corrupt, and before the claim existed
   * the layer was drawn from `assetUrl(source)` regardless — so a bad one cost nothing visible.
   * The claim would now leave that layer empty and silent, and the next ⌘S would write the empty
   * layer over the asset. The claim is given back and the asset drawn, which is what it did.
   */
  private fallBackToSource(key: string, surface: LayerSurface): void {
    surface.fromDocument = false

    const layer = this.state && layerById(this.state, key)
    if (!layer || layer.kind !== 'pixel' || layer.source === undefined) return

    void this.loadInto(key, assetUrl(layer.source)).catch(error =>
      reportFailure('canvas.layer', layer.source ?? key, error),
    )
  }

  /** Rectangle, ellipse or lasso: three gestures behind one tool, as the bar offers them. */
  setSelectionShape(shape: SelectionShape): void {
    this.selectionShape = shape
  }

  /** Rectangle, line, arrow, ellipse, polygon or star — the six the bar offers. */
  setShape(kind: ShapeKind, sides = this.shapeSides): void {
    this.shapeKind = kind
    this.shapeSides = sides
  }

  /**
   * The caption a field is typing elsewhere. Its sprite steps aside for as long as that lasts, so
   * the words are drawn once and by one thing — never twice, half a pixel apart.
   *
   * Session state, like the selection: nothing about the document changes, so `visible` is left
   * alone and ⌘Z gives back no layer nobody hid.
   */
  setEditingText(layerId: string | null): void {
    if (this.editing === layerId) return
    this.editing = layerId
    this.reconcile()
    this.render()
  }

  /** Session state, so React owns it: the engine draws it and clips strokes to it. */
  setSelection(selection: CanvasSelection): void {
    this.selection = selection
    this.overlay.invalidate()
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
    cancelAnimationFrame(this.selectionFrame)
    this.resizer?.disconnect()
    this.resizer = null
    this.overlay.dispose()
    this.patches?.dispose()
    this.patches = null

    for (const surface of this.surfaces.values()) surface.texture.destroy(true)
    this.surfaces.clear()
    this.contents.clear()
    // The tree is gone, so no placement holds: kept, it would make the replay in a remount find
    // the signature unchanged and skip the `attach` that is now the only way anything is hung.
    this.stacking = ''
    // Same reason, and a sharper one: a frame kept across a remount would stand in the previous
    // document's coordinates, armed for ⏎.
    this.setCropping(null)
    for (const container of this.groups.values()) container.destroy()
    this.groups.clear()
    for (const pass of this.adjustments.values()) pass.destroy()
    this.adjustments.clear()
    for (const clip of this.clips.values()) this.destroyClip(clip)
    this.clips.clear()
    this.pendingMaskFills.clear()
    this.pendingSnapshots.clear()
    for (const picture of this.pendingPictures.values()) picture.destroy(true)
    this.pendingPictures.clear()
    this.drawings.clear()
    this.dropClipping()
    this.isolation?.destroy()
    this.isolation = null
    this.stamp.destroy()
    // The filter is not the stamp's to free: it is held here, and a destroyed Graphics takes
    // only what it made itself.
    this.softener.destroy()

    // `removeView`, because the canvas belongs to this engine now: leaving it behind would
    // stack a dead canvas per mount.
    this.app?.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
    this.app = null
    this.host = null
  }

  private readPalette(canvas: HTMLCanvasElement): void {
    this.colors = readColors(canvas)
    this.rulerFont = tokenAsFont(canvas, '--text-micro', RULER_FONT_SIZE, RULER_FAMILY)
    this.overlay.invalidate()
  }

  private measure(): void {
    const host = this.host
    if (!host) return

    // Before anything reads the box: Pixi honours `resizeTo` through a `window.resize` listener
    // and nothing else — see `followHostSize` — so a Dockview splitter left the picture at its
    // mounted size while the overlay, which observes the host, followed. The handles then sat
    // beside the layer they belong to. Here rather than in a second observer so the order is
    // stated: the renderer takes the new box, then the overlay is measured against it.
    this.app?.resize()

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
      rulerFont: this.rulerFont,
      language: this.language,
      marching: this.marching(),
      // Handed over whole rather than gated here: every painter already returns on nothing to
      // draw, and a gate repeating those guards is one a new decoration gets forgotten from —
      // silently, since nothing would fail, it would simply never appear.
      tools: {
        crop: this.cropping,
        handles: this.activeCorners(),
        lit: this.hover?.kind === 'handle' ? this.hover.id : null,
        pending: this.pendingShape(),
        textBox: this.textBox,
        selection: this.selection,
        // Not while the tool is refusing: a ring is a promise that a dab lands there.
        brushRadius: this.ringed() && !this.refuses() ? this.brush.size / 2 : null,
      },
    }
  }

  /**
   * Whether anything on screen is dashed, which is what keeps the overlay's frame loop alive.
   * Kept beside what draws the ants: a fourth dashed surface that forgot to say so would simply
   * stand still.
   */
  private marching(): boolean {
    return (
      selectionOutline(this.selection).length > 0 || this.cropping !== null || this.textBox !== null
    )
  }

  /**
   * The shape under the hand, dressed in the paint it will be committed with — the overlay draws
   * what will land, not a marquee around where it will.
   *
   * Stroked rather than filled for the two that have no inside; the brush size is the width,
   * which is the one control the bar already offers.
   */
  private pendingShape(): PendingShape | null {
    const shape = this.pending
    if (!shape) return null

    const color = colourOf(this.brush.color)
    return shape.kind === 'line' || shape.kind === 'arrow'
      ? { shape, fill: null, stroke: { color, width: strokeWidth(this.brush.size) } }
      : { shape, fill: color, stroke: null }
  }

  private render(): void {
    if (this.app) this.app.renderer.render(this.app.stage)
  }

  private syncLayer(layer: Layer): void {
    // Read before the build: a picture is drawn once, when its surface comes into existence —
    // which is also the only moment the engine can know the layer at all.
    const born = !this.surfaces.has(layer.id)
    // Words and shapes are redrawn whenever they change, unlike pixels, which are what the layer
    // holds. The face counts as a change: without it, setting a caption in another font is an
    // edit the screen never shows, and a face the page was never asked for.
    const drawn = drawingKey(layer)
    const surface = this.buildSurface(layer.id, layer.kind === 'pixel' ? layer.fill : undefined)
    if (!surface) return

    // Never while a field is drawing the caption: its sprite is hidden, so rasterizing it would
    // be a Pixi `Text` and a full frame per KEYSTROKE, for a texture nobody can see. The key is
    // left unwritten on purpose — the redraw then happens once, when the field lets go.
    const typing = layer.id === this.editing
    if (drawn !== null && !typing && this.drawings.get(layer.id) !== drawn) {
      this.drawings.set(layer.id, drawn)
      if (layer.kind === 'text') this.drawText(surface, layer)
      if (layer.kind === 'shape') this.drawShape(surface, layer)
    }

    // A flatten composed its picture before the command ran; this is the surface it was for.
    if (born) this.drainPendingPicture(layer.id, surface)
    // Before the reload below, which is the whole ordering: the drain is what claims the surface.
    if (born) this.drainPendingSnapshot(layer.id, surface)

    // Never over pixels the document filled in — see `LayerSurface.fromDocument`.
    if (born && layer.kind === 'pixel' && layer.source !== undefined && !surface.fromDocument) {
      // Unawaited: one unreadable asset must not take the rest of the document's reconciliation
      // down with it. The layer then lists in the panel and draws nothing, hence the report.
      void this.loadInto(layer.id, assetUrl(layer.source)).catch(error =>
        reportFailure('canvas.layer', layer.source ?? layer.id, error),
      )
    }

    surface.sprite.visible = layer.visible && layer.id !== this.editing
    // `fillOpacity` is meant to fade the pixels while leaving the effects drawn around them at
    // full strength. No layer effect exists yet, so for now the two simply multiply.
    surface.sprite.alpha = layer.opacity * layer.fillOpacity
    surface.sprite.blendMode = BLEND_BY_MODE[layer.blend]
    this.place(surface.sprite, layer.transform, surface.texture)

    // Allocated only where the state asks for one: a mask per layer, built ahead, would double
    // the document's GPU memory for a feature most layers never use.
    if (!layer.mask) return
    const bornMasked = !this.surfaces.has(maskKey(layer.id))
    // White, so a mask reveals everything until something is painted into it. Born cleared, it
    // would hide the layer whole the moment the box is ticked. The channel is Pixi's default red,
    // which is what makes the mask read like Photoshop's: paint black to hide, white to reveal.
    const mask = this.buildSurface(maskKey(layer.id), WHITE)
    if (!mask) return

    this.place(mask.sprite, surfaceTransform(layer, true), mask.texture)
    if (bornMasked) this.drainPendingMask(layer.id, mask)
    if (bornMasked) this.drainPendingSnapshot(maskKey(layer.id), mask)
  }

  /**
   * The words, rasterized into the layer's own texture. `clear: true`, so editing a caption
   * replaces it rather than laying the new one over the old.
   */
  private drawText(surface: LayerSurface, layer: TextLayer): void {
    const renderer = this.app?.renderer
    if (!renderer) return

    const text = new Text({
      text: layer.text,
      style: {
        fontFamily: familyStack(layer.font),
        fontSize: layer.size,
        fill: layer.color,
        align: layer.align,
        // Wrapped, never cut: a caption that outgrows its box spills past it, as one does in
        // Photoshop — which is why the texture is the document's size and not the box's.
        wordWrap: true,
        wordWrapWidth: layer.box.width,
        lineHeight: layer.size * layer.lineHeight,
        letterSpacing: (layer.tracking / 1000) * layer.size,
      },
    })
    renderer.render({ container: text, target: surface.texture, clear: true })
    text.destroy()
    this.render()

    // The face the caption asks for may not be in the page yet. Registered once, and the caption
    // drawn again when it lands — until then the browser has drawn it in the generic beside it.
    // Caught here and not inside: the landing redraws every caption of the family, so one refusing
    // to rasterize would strand the rest in the generic silently. Unhandled, it says nothing at all.
    void this.registerFace(layer).catch(error =>
      reportFailure('font.face', layer.font.family, error),
    )
  }

  /**
   * The shape, drawn into the layer's own texture at the layer's origin. `clear: true`, so
   * recolouring one replaces it rather than laying the new paint over the old.
   */
  private drawShape(surface: LayerSurface, layer: ShapeLayer): void {
    const renderer = this.app?.renderer
    if (!renderer) return

    const drawing = new Graphics()
    paintShape(drawing, shapeOf(layer))
    if (layer.fill !== null) drawing.fill({ color: layer.fill })
    if (layer.stroke) drawing.stroke({ color: layer.stroke.color, width: layer.stroke.width })

    renderer.render({ container: drawing, target: surface.texture, clear: true })
    drawing.destroy()
    this.render()
  }

  /**
   * Puts an embedded face in the page, and redraws every caption set in it.
   *
   * Once per family, whatever asks: a document of twenty captions in one font must not fetch it
   * twenty times, and a face already in the page is one `drawText` needs nothing more from. That
   * one fetch is why the landing sweeps the document instead of the caption that happened to ask —
   * the other nineteen were turned away at the early return, and no landing of their own is coming.
   */
  private async registerFace(layer: TextLayer): Promise<void> {
    const url = faceUrlOf(layer.font)
    const family = layer.font.family
    if (!url || this.faces.has(family)) return

    this.faces.add(family)
    try {
      await this.options.addFace(family, url)
    } catch (error) {
      // Kept in the set: retrying on every reconciliation would fetch a file that is not there
      // once per frame. The caption stays in the generic, and the failure is said once.
      reportFailure('font.face', family, error)
      return
    }

    // Looked up rather than held: only the caption that asked came with a surface. `reconcile`
    // syncs every caption in the tree, so the guard below is the map's type, not a case in the wild.
    for (const caption of captionsSetIn(this.state, family)) {
      const surface = this.surfaces.get(caption.id)
      if (surface) this.drawText(surface, caption)
    }
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
    const surface: LayerSurface = { texture, sprite: new Sprite(texture), fromDocument: false }
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
    // open would make the next drag of that guide re-create it instead of moving it. A crop frame
    // is untouched by this: it is not a gesture, and panning to see it is the point.
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
      if (!target) return

      this.patches?.touch(this.beginPixels(target))
      // Edge to edge, or to the selection when there is one: that is what gives a layer a plain
      // white, black or red background in one gesture, and a region its flat colour.
      this.fill(target.surface, this.brush.color, target.toSurface)
      this.endPixels()
      // The renderer runs on demand, so a texture written outside a gesture is a texture nobody
      // presents: the bucket only appeared once a pan or a zoom booked the next frame.
      this.render()
      return
    }

    // Below the pan branch on purpose: panning is the one gesture no tool may take over, and
    // these must not paint either — falling through would land them on the brush path, so
    // arming `Rectangle` would leave a dab.
    if (UNBUILT_TOOLS.has(this.tool)) return

    if (this.tool === 'move') {
      const layer = this.activeLayer()
      if (!layer || layer.locked.position) return

      // The chrome first: a drag on a grip, or in the ring outside a corner, is not a drag of
      // the layer. Answered by the same test the cursor asked, so the two cannot disagree.
      const box = this.hoverBox()
      const hit = box && this.chromeAt(box, point)
      if (box && hit) {
        const corners = box.corners
        this.options.layers.beginDrag()
        this.gesture =
          hit.kind === 'handle'
            ? { kind: 'handle', id: layer.id, handle: hit.id, from: point, origin: layer.transform }
            : {
                kind: 'rotate',
                id: layer.id,
                center: centerOf(corners),
                from: point,
                origin: layer.transform,
              }
        return
      }

      this.options.layers.beginDrag()
      this.gesture = {
        kind: 'move',
        id: layer.id,
        from: point,
        origin: { x: layer.transform.x, y: layer.transform.y },
      }
      return
    }

    if (this.tool === 'text') {
      // A caption already under the hand is the one the click edits. Without this, every click
      // with the tool armed stacked one more layer on the last.
      const caption = this.captionAt(point)
      if (caption) {
        this.options.onText({ layerId: caption.id })
        return
      }

      // The box comes from the drag, or from a click, which has none: settled on release.
      this.gesture = { kind: 'text', from: point, to: point }
      return
    }

    if (this.tool === 'shape') {
      // No paint target and no undo tiles: a shape lands as a layer of its own, so the armed
      // layer is neither written to nor required to exist.
      this.gesture = { kind: 'shape', from: point, to: point }
      return
    }

    if (this.tool === 'crop') {
      // The grips of a placed frame come first, exactly as the move tool's do: a press on one
      // adjusts the frame, a press anywhere else starts a new one over it.
      const frame = this.hoverBox()
      const grip = frame && this.chromeAt(frame, point)
      if (this.cropping && grip) {
        this.gesture = { kind: 'cropHandle', handle: grip.id, origin: this.cropping }
        return
      }

      this.setCropping(null)
      this.overlay.invalidate()
      this.gesture = { kind: 'crop', from: point }
      return
    }

    if (this.tool === 'select') {
      this.gesture = { kind: 'select', from: point }
      this.publishSelection(dragSelection(this.selectionShape, point, point, false))
      return
    }

    const target = this.paintTarget()
    if (!target) return

    this.beginPixels(target)
    // The target rides with the gesture: re-resolving the active layer on every move would let a
    // stroke change surface mid-drag, and its map back to the pixels along with it.
    this.gesture = { kind: 'paint', from: point, target }
    this.dab(target, [point])
  }

  /**
   * Moved locally and told to React once a frame, exactly as the viewport is: routing every
   * pointer move through the store and back would put a React commit between the gesture and
   * the marquee it draws.
   */
  private publishSelection(selection: CanvasSelection): void {
    this.selection = selection
    this.overlay.invalidate()

    this.publishingSelection = { selection }
    if (this.selectionFrame === 0) {
      this.selectionFrame = requestAnimationFrame(this.publishSelected)
    }
  }

  private readonly publishSelected = (): void => {
    this.selectionFrame = 0
    const pending = this.publishingSelection
    this.publishingSelection = null
    if (pending) this.options.onSelection(pending.selection)
  }

  private activeLayer(): Layer | null {
    return this.state ? layerById(this.state, this.state.activeLayerId) : null
  }

  private documentSize(): Size {
    return { width: this.state?.width ?? 0, height: this.state?.height ?? 0 }
  }

  /**
   * The rect a layer's grips describe: the picture it holds where it holds one, its whole
   * surface otherwise.
   *
   * A layer painted by hand has no better answer — every pixel of its surface is fair game. One
   * holding a photo does: `containIn` shrank it to fit and centred it, so the surface is mostly
   * transparent margin, and gripping that is gripping nothing. This is what every other editor
   * frames for a picture layer.
   */
  private frameOf(layerId: string): Rect {
    return this.contents.get(layerId) ?? wholeOf(this.documentSize())
  }

  /** `null` for a group, which has no texture of its own and so no box to grab. */
  private cornersOf(layer: Layer): Corners | null {
    if (!this.state || isGroup(layer)) return null
    return layerCornersOf(layer.transform, this.documentSize(), this.frameOf(layer.id))
  }

  /**
   * The corners of the armed layer, when there is one a grip may be taken on. Memoised on the
   * tree's identity and the armed id: an idle hover would otherwise flatten the layer tree twice
   * per pointer move, and pay for every layer in the document to answer about one.
   */
  private activeCorners(): Corners | null {
    if (this.tool !== 'move') return null
    if (this.corners.of === this.state) return this.corners.box

    const layer = this.activeLayer()
    const box = layer && !layer.locked.position ? this.cornersOf(layer) : null
    this.corners = { of: this.state, box }
    return box
  }

  /**
   * Whether the armed tool can do nothing at all where the hand is — a group or an adjustment
   * layer under the brush, a padlock on the pixels, a layer pinned under the move tool.
   *
   * Answered by the very test the gesture will run, never by a copy of it: a cursor that
   * promises a stroke the press then refuses is worse than no cursor at all.
   */
  private refuses(): boolean {
    const cached = this.refusal
    if (
      cached &&
      cached.of === this.state &&
      cached.tool === this.tool &&
      cached.painting === this.painting
    ) {
      return cached.value
    }

    const value = this.wouldRefuse()
    this.refusal = { of: this.state, tool: this.tool, painting: this.painting, value }
    return value
  }

  private wouldRefuse(): boolean {
    if (this.tool === 'move') {
      const layer = this.activeLayer()
      return !layer || layer.locked.position
    }

    return WRITING_TOOLS.has(this.tool) && this.paintTarget() === null
  }

  /** The surface a stroke may land on: armed, able to hold pixels, and not padlocked. */
  private paintTarget(): BrushTarget | null {
    const layer = this.activeLayer()
    if (!layer || isGroup(layer) || layer.locked.pixels) return null
    // Its own pixels only: a caption is redrawn whole whenever a letter changes, so a stroke laid
    // on it would be wiped with no history entry to bring it back. Its mask is never redrawn.
    if (layer.kind === 'text' && this.painting !== 'mask') return null

    const surface = this.activeSurface()
    // No surface means the layer carries no mask while the brush aims at one: there is nothing
    // to paint, and nothing to say about it either.
    if (!surface) return null

    // A layer crushed onto a line has no way back from the document to its pixels. Declining the
    // stroke is the only safe answer: painting through a singular map writes NaN over the whole
    // texture, and no undo brings those back.
    const toSurface = invert(this.surfaceMatrix(layer, this.painting === 'mask', surface))
    return toSurface ? { key: this.paintKey(layer.id), surface, toSurface } : null
  }

  /**
   * Where a surface's pixels land in the document, as `syncLayer` places them — the layer's own
   * transform, or the identity for a mask that was unlinked from it, and always against the box
   * `place` was given, which is the texture rather than the document.
   */
  private surfaceMatrix(layer: Layer, mask: boolean, surface: LayerSurface): Affine {
    return layerMatrix(surfaceTransform(layer, mask), surface.texture)
  }

  /**
   * Wraps document-space artwork so it lands on the surface's own pixels. One container, reused:
   * a dab runs per `pointermove`, and a fresh node per dab is an allocation per frame of a drag.
   */
  private inSurfaceSpace(toSurface: Affine, content: Container): Container {
    this.paintSpace.removeChildren()
    this.paintSpace.addChild(content)
    this.paintMatrix.set(
      toSurface.a,
      toSurface.b,
      toSurface.c,
      toSurface.d,
      toSurface.tx,
      toSurface.ty,
    )
    this.paintSpace.setFromMatrix(this.paintMatrix)
    return this.paintSpace
  }

  private documentRect(): Rect | null {
    const state = this.state
    return state ? { x: 0, y: 0, width: state.width, height: state.height } : null
  }

  /**
   * Opens a recording and hands back the surface's own rectangle, which the bucket then dirties
   * whole. Counted against the texture rather than the document: tiles index the surface being
   * written to, and the two only happen to share a size.
   */
  private beginPixels(target: BrushTarget): Rect {
    const { width, height } = target.surface.texture
    this.patches?.begin(newId(), target.key, target.surface.texture, { width, height })
    return { x: 0, y: 0, width, height }
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
    // Two things follow the pointer without a gesture: the rulers echo it, and the brush ring
    // rides on it. Either one makes an idle move cost one overlay frame; neither armed, and it
    // costs none.
    if (this.view.rulers || this.ringed()) this.overlay.invalidate()

    const gesture = this.gesture
    if (gesture.kind === 'none') return this.hovering(host)

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
        // A lasso follows the hand; the other two are a box between where it started and where
        // it is now, so only the lasso needs what came before.
        this.publishSelection(
          this.selectionShape === 'lasso'
            ? extendLasso(this.selection, point)
            : dragSelection(this.selectionShape, gesture.from, point, event.shiftKey),
        )
        return
      }
      case 'paint': {
        this.stroke(gesture.target, gesture.from, point)
        this.gesture = { kind: 'paint', from: point, target: gesture.target }
        return
      }
      case 'handle': {
        // The same frame the grips were drawn on: solved against the document instead, a pull on
        // a photo that does not fill its surface would scale from the wrong corner.
        const next = resizeBy(
          gesture.origin,
          gesture.handle,
          this.documentSize(),
          point,
          event.shiftKey,
          this.frameOf(gesture.id),
        )
        this.options.layers.transform(gesture.id, next)
        return
      }
      case 'rotate': {
        const next = rotateBy(gesture.origin, gesture.center, gesture.from, point, event.shiftKey)
        this.options.layers.transform(gesture.id, next)
        return
      }
      case 'crop': {
        // Clamped here rather than at the commit, so the frame drawn is the frame applied.
        this.setCropping(cropRect(gesture.from, point, this.documentSize(), event.shiftKey))
        this.overlay.invalidate()
        return
      }
      case 'cropHandle': {
        // Against the frame the drag started on, never the current one: every move is absolute,
        // or a grip nudged twice would compound its own displacement.
        const size = this.documentSize()
        const next = resizeCrop(gesture.origin, gesture.handle, point, size, event.shiftKey)
        // A collapsed adjustment keeps the last good frame rather than dropping it: the hand is
        // still down, and a frame that vanished mid-drag could not be pulled back open.
        if (next) this.setCropping(next)
        this.overlay.invalidate()
        return
      }
      case 'shape': {
        // Previewed in the overlay, not in the layer: a layer per pointer move would be a
        // hundred entries in the history for one gesture.
        gesture.to = constrainedTo(this.shapeKind, gesture.from, point, event.shiftKey)
        this.pending = shapeGeometry(this.shapeKind, gesture.from, gesture.to, {
          sides: this.shapeSides,
          constrain: false,
        })
        this.overlay.invalidate()
        return
      }
      case 'text': {
        gesture.to = point
        this.textBox = box(gesture.from, point, false)
        this.overlay.invalidate()
        return
      }
    }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    // The corner counts: a guide dropped anywhere on the chrome is a guide thrown away.
    const onChrome = this.inRuler(this.toHost(event)) !== null
    this.forgetHover()
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
    if (LAYER_DRAGS.has(gesture.kind)) this.options.layers.endDrag()
    if (gesture.kind === 'paint') this.endPixels()
    if (gesture.kind === 'shape') this.commitShape(gesture.from, gesture.to)
    if (gesture.kind === 'text') this.commitText(gesture.from, gesture.to)
    // A click that carved nothing out is how every editor deselects. Left standing, a zero-area
    // selection is a stencil nothing gets through, and the document stops taking paint at all.
    if (gesture.kind === 'select' && isEmptySelection(this.selection)) this.publishSelection(null)
  }

  /**
   * What an idle pointer is over, and what the cursor says about it. Repaints only when the
   * answer changed: a hand resting on the canvas must not buy a frame of overlay per event.
   *
   * Space held wins over everything — it is a pan in waiting, and `releaseSpace` gives the
   * cursor back.
   */
  private hovering(host: Point): void {
    const box = this.spacing ? null : this.hoverBox()
    const next = box && this.chromeAt(box, toDocument(this.view.viewport, host))
    // Weighed alongside the grip, never behind it: a refusing tool holds no chrome, so both
    // hits compare equal on every move and a test on the grip alone would return before the
    // refusal was ever read.
    const refused = !this.spacing && this.refuses()
    if (sameHit(next, this.hover) && refused === this.refused) return

    this.hover = next
    this.refused = refused
    // The refusal wins over a grip: a padlocked layer still draws its box, and an arrow over one
    // would promise a pull the press declines.
    if (!this.spacing) {
      this.setCursor(refused ? 'not-allowed' : box && next ? cursorFor(next, box.facing) : '')
    }
    this.overlay.invalidate()
  }

  /**
   * The chrome a press or a hover may take hold of — the armed layer's box, or the crop frame.
   * Never both: the two tools that draw grips are mutually exclusive.
   *
   * A crop does not turn the document, so its rotation ring has no reach at all. Spelling that as
   * a zero rather than as a second code path is what keeps the frame's grips and the layer's
   * answering to one hit test.
   */
  private hoverBox(): HoverBox | null {
    if (this.tool === 'crop') {
      return this.cropping
        ? { corners: cornersOfRect(this.cropping), reach: 0, facing: UPRIGHT }
        : null
    }

    const corners = this.activeCorners()
    const facing = this.activeLayer()?.transform
    if (!corners || !facing) return null
    return { corners, reach: ROTATE_REACH, facing }
  }

  /** Both tolerances are screen pixels, so a grip stays as easy to take at 5% as at 800%. */
  private chromeAt(box: HoverBox, point: Point): HandleHit | null {
    const scale = this.view.viewport.scale
    return hitTest(box.corners, point, HANDLE_GRAB / scale, box.reach / scale)
  }

  private readonly onPointerLeave = (): void => {
    this.pointer = null
    this.forgetHover()
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
    if (this.gesture.kind === 'pan') return

    this.setCursor('')
    // What the pointer was over was left standing while space held the cursor. Dropped rather
    // than kept: the hover is only recomputed when it *changes*, so a grip the hand never left
    // would compare equal on the next move and its arrow would never come back. Same for the
    // refusal, which is weighed the same way.
    this.hover = null
    this.refused = false
    this.overlay.invalidate()
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
      this.moveTo(zoomCanvasAt(viewport, scale, this.toHost(event)))
      return
    }

    this.moveTo({ ...viewport, x: viewport.x - event.deltaX, y: viewport.y - event.deltaY })
  }

  /**
   * Paints a surface edge to edge. `clip` is the bucket's way back into the pixels, and its
   * presence is what makes the fill stop at the selection; a surface being born never does — a
   * mask born white inside a marquee and transparent outside would hide its layer everywhere
   * else the moment it appeared.
   */
  private fill(surface: LayerSurface, color: number, clip?: Affine): void {
    const renderer = this.app?.renderer
    if (!renderer || !this.state) return

    const sheet = new Graphics()
    // The document's own rectangle when the bucket draws it, since the stencil beside it is cut
    // in document space; the texture's when a surface is being born, which has no stencil and
    // must come out filled corner to corner whatever its layer's transform is.
    const box = clip ? this.state : surface.texture
    sheet.rect(0, 0, box.width, box.height)
    sheet.fill({ color })

    const container = clip ? this.inSurfaceSpace(clip, this.clipped(sheet)) : sheet
    renderer.render({ container, target: surface.texture, clear: false })
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
  private stroke(target: BrushTarget, from: Point, to: Point): void {
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
    this.dab(target, points)
  }

  /**
   * Every point of the segment in ONE render pass. A pass per point meant a framebuffer bind and
   * a draw call per interpolated dab — up to several hundred inside a single `pointermove`.
   *
   * It is also the only way the opacity comes out right: separate passes composite the dabs onto
   * each other, so a half-opaque stroke darkened at every joint.
   */
  private dab(target: BrushTarget, points: readonly Point[]): void {
    const renderer = this.app?.renderer
    if (!renderer || points.length === 0) return

    // Before a single pixel is written: what the tiles hold now is what an undo will put back.
    // Mapped onto the surface, like the dabs themselves — tiles index the texture, and a stroke
    // on a turned layer covers a different set of them than its document-space box suggests.
    //
    // The fringe is added AFTER the mapping, and it has to be: a filter is applied once the
    // container's transform has run, so its padding is a count of surface pixels while the
    // brush's radius is a count of document ones. Added before, a layer scaled 2× recorded half
    // the box its stroke actually covered, and an undo left the fringe behind.
    this.patches?.touch(
      grownBy(mapRect(target.toSurface, brushRect(points, this.brush.size / 2)), this.fringe()),
    )

    const erasing = this.tool === 'eraser'
    this.stamp.clear()
    for (const point of points) this.stamp.circle(point.x, point.y, this.brush.size / 2)
    this.stamp.fill({ color: erasing ? 0xffffff : this.brush.color, alpha: this.brush.opacity })
    // Erasing is the same stroke in `erase` blend: on a transparent layer, painting white
    // would just paint white.
    this.stamp.blendMode = erasing ? 'erase' : 'normal'

    // `clear: false`, or every dab would wipe the stroke that came before it. And `target`,
    // not the `renderTexture` option, which v8 deprecated.
    renderer.render({
      container: this.inSurfaceSpace(target.toSurface, this.clipped(this.stamp)),
      target: target.surface.texture,
      clear: false,
    })
    this.render()
  }

  /**
   * What to render so a stroke stops at the selection's edge. Cut on the GPU rather than tested
   * per dab: the shape is a stencil, and the same one serves the brush, the eraser and the
   * bucket. Handed back unchanged when nothing is selected, which is the common case.
   */
  private clipped(container: Container): Container {
    const outline = selectionOutline(this.selection)
    const first = outline[0]
    if (!first) {
      this.dropClipping()
      return container
    }

    const stencil = new Graphics()
    stencil.moveTo(first.x, first.y)
    for (const point of outline.slice(1)) stencil.lineTo(point.x, point.y)
    stencil.fill({ color: 0xffffff })

    const holder = new Container()
    holder.addChild(stencil)
    holder.addChild(container)
    holder.mask = stencil
    // Rebuilt per pass rather than kept: a held stencil would have to be invalidated on every
    // selection change.
    this.dropClipping()
    this.clipping = { holder, stencil }
    return holder
  }

  /**
   * Frees the pass, and only the pass. Its borrowed children leave first: a holder freed with
   * its subtree took the brush's stamp with it, and the stamp is built once with the engine —
   * so the first stroke after a marquee was dropped killed the brush for the whole session.
   */
  private dropClipping(): void {
    const clipping = this.clipping
    this.clipping = null
    if (!clipping) return

    clipping.holder.removeChildren()
    clipping.stencil.destroy()
    clipping.holder.destroy()
  }

  /**
   * The one place the frame changes, so that nothing can move it without the bar hearing.
   *
   * Reported only when there is or is not one, never on the frame itself: this runs on every
   * pointer move of a crop drag, and the bar has the same answer for all of them.
   */
  private setCropping(rect: Rect | null): void {
    const framed = this.cropping !== null
    this.cropping = rect
    if (framed !== (rect !== null)) this.options.onCropFrame(rect !== null)
  }

  /** Crops the document to the frame on screen, in the one order the three steps work in. */
  applyCrop(): void {
    const rect = this.cropping
    if (!rect) return

    this.setCropping(null)
    this.overlay.invalidate()
    // A marquee is in document coordinates and the crop moves the picture under it: left
    // standing it would stencil the wrong pixels, or none at all once the frame stops reaching
    // it — and the brush would go silently dead.
    this.publishSelection(null)
    // The pixels before the state: `resurface` recuts every surface to the kept region, so the
    // `apply` the command triggers finds them already the right size and leaves them alone.
    this.resurface({ width: rect.width, height: rect.height }, rect)
    this.options.onCrop(rect)
  }

  /** Takes the frame off screen without cropping anything. */
  dropCrop(): void {
    if (!this.cropping) return
    this.setCropping(null)
    this.overlay.invalidate()
  }

  /**
   * The caption's box, once the hand comes up. A drag too small to have been meant as one opens
   * the default box instead, which is what makes a plain click work.
   */
  private commitText(from: Point, to: Point): void {
    this.textBox = null
    this.overlay.invalidate()

    const drawn = box(from, to, false)
    const dragged = drawn.width >= MIN_TEXT_DRAG && drawn.height >= MIN_TEXT_DRAG
    this.options.onText(
      dragged
        ? { at: { x: drawn.x, y: drawn.y }, box: { width: drawn.width, height: drawn.height } }
        : { at: from, box: DEFAULT_TEXT_BOX },
    )
  }

  /** The topmost caption whose box holds the point — what a click with the text tool edits. */
  private captionAt(point: Point): TextLayer | null {
    const size = this.documentSize()
    for (const layer of allLayers(this.state?.layers ?? []).reverse()) {
      if (layer.kind !== 'text' || !layer.visible) continue

      const back = invert(layerMatrix(layer.transform, size))
      if (!back) continue

      const local = applyTo(back, point)
      const inside =
        local.x >= 0 && local.y >= 0 && local.x <= layer.box.width && local.y <= layer.box.height
      if (inside) return layer
    }
    return null
  }

  /**
   * Hands the drawn shape over as a LAYER, once, when the hand comes up — rasterizing it into the
   * armed layer would make the fill of a rectangle drawn an hour ago something only undo can fix.
   */
  private commitShape(from: Point, to: Point): void {
    const drawn = this.pending
    this.pending = null
    this.overlay.invalidate()
    if (!drawn) return

    const line = drawn.kind === 'line' || drawn.kind === 'arrow'
    const width = strokeWidth(this.brush.size)
    const local = localShape(this.shapeKind, from, to, this.shapeSides, line ? width : 0)

    this.options.onShape(local.at, {
      shape: this.shapeKind,
      from: local.from,
      to: local.to,
      sides: this.shapeSides,
      fill: line ? null : this.brush.color,
      stroke: line ? { color: this.brush.color, width } : null,
    })
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
