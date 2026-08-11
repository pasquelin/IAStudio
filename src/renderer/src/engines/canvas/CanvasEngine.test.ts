import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { NEUTRAL_ADJUSTMENTS, type AdjustmentStack } from '@shared/domain/adjustments'
import type { FontRef } from '@shared/domain/font'
import type { FaceRegistrar } from './canvas-fonts'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
import { layerFixture } from './canvas-fixtures'
import {
  adjustmentLayer,
  BLEND_MODES,
  DEFAULT_CANVAS,
  groupLayer,
  IDENTITY,
  isGroup,
  pixelLayer,
  textLayer,
  UNLOCKED,
  type CanvasState,
  type Layer,
  type Rect,
  type Transform,
} from './canvas-state'
import { DEFAULT_BRUSH } from './brush'
import { PixelPatches } from './PixelPatches'
import type { CanvasTool } from './CanvasEngine'
import type { CanvasSelection } from './canvas-selection'
import type { Point } from './shape-geometry'
import { RULER_SIZE } from './CanvasOverlay'
import { DEFAULT_VIEW, toDocument, type Viewport } from './viewport'

/**
 * jsdom has no WebGL context, so Pixi is doubled. What is tested here is what the engine
 * *decides* — which surfaces it builds, which gesture a click starts, what it publishes — never
 * what lands on the GPU, which only a real renderer could tell.
 *
 * It exists because the alternative was believed for a while: that this file could not be tested
 * at all. A guard added to `apply` then silently stopped a freshly opened document from ever
 * building a texture, and nothing caught it.
 */
type Pair = { x: number; y: number }

/** A node of the built tree, seen through what the engine is allowed to write on it. */
type Placed = {
  readonly children: Placed[]
  parent: Placed | null
  position: Pair
  scale: Pair
  pivot: Pair
  skew: Pair
  rotation: number
  visible: boolean
  alpha: number
  blendMode: string
  label: string
  filters: object[]
  mask: object | null
  maskChannel: string
  size: { width: number; height: number } | null
  destroyed: boolean
  matrix: { a: number; b: number; c: number; d: number; tx: number; ty: number } | null
}

const gpu: {
  renders: number
  texturesCreated: number
  texturesDestroyed: number
  /** Every attach and detach: the cost a restack pays, and the one a repaint must not. */
  mutations: number
  /** What the engine asked the renderer for, so the options it depends on can be asserted. */
  init: Record<string, unknown>
  /** Every sprite built, in the order they were built: one per paintable layer. */
  sprites: Placed[]
  /** Every container built, groups included — they are found back by their label. */
  containers: Placed[]
  /** The id of every texture a render was aimed at: which surface a stroke actually wrote to. */
  painted: number[]
  /** What the engine asked the asset loader for, so the parser it forces can be asserted. */
  loaded: { src: string; parser?: string }[]
  /** Set by the one test that needs a load to fail: an asset whose file is gone. */
  refuseLoad: boolean
  /** Every extraction, so what a snapshot framed and at what scale can be asserted. */
  extracted: { frame?: unknown; resolution?: number }[]
  /** Every frame the eyedropper read, so what it sampled — and how much of it — can be asserted. */
  sampled: { x: number; y: number; width: number; height: number }[]
  /** What the renderer hands back, so a test can name the colour standing under the pointer. */
  pixels: number[]
} = {
  renders: 0,
  texturesCreated: 0,
  texturesDestroyed: 0,
  mutations: 0,
  init: {},
  sprites: [],
  containers: [],
  painted: [],
  loaded: [],
  refuseLoad: false,
  extracted: [],
  sampled: [],
  pixels: [0, 0, 0, 0],
}

vi.mock('pixi.js/unsafe-eval', () => ({}))
vi.mock('pixi.js/advanced-blend-modes', () => ({}))

vi.mock('pixi.js', () => {
  /** The six numbers of an affine map, which is all the engine ever builds one from. */
  class Matrix {
    a = 1
    b = 0
    c = 0
    d = 1
    tx = 0
    ty = 0

    set(a: number, b: number, c: number, d: number, tx: number, ty: number): void {
      this.a = a
      this.b = b
      this.c = c
      this.d = d
      this.tx = tx
      this.ty = ty
    }
  }

  /** Pixi's `ObservablePoint`, reduced to what a test needs: a value it can read back. */
  class Pair {
    x: number
    y: number

    constructor(value = 0) {
      this.x = value
      this.y = value
    }

    set(x: number, y = x): void {
      this.x = x
      this.y = y
    }
  }

  class Container {
    readonly children: Container[] = []
    parent: Container | null = null
    readonly position = new Pair()
    readonly scale = new Pair(1)
    readonly pivot = new Pair()
    readonly skew = new Pair()
    visible = true
    alpha = 1
    rotation = 0
    blendMode = 'normal'
    label = ''
    filters: object[] = []
    mask: object | null = null
    maskChannel = 'red'
    size: { width: number; height: number } | null = null
    destroyed = false
    matrix: { a: number; b: number; c: number; d: number; tx: number; ty: number } | null = null

    constructor(options: { label?: string } = {}) {
      this.label = options.label ?? ''
      gpu.containers.push(this)
    }

    addChild(child: Container): void {
      gpu.mutations += 1
      // Pixi reparents rather than sharing: a child belongs to one container at a time, and the
      // clipping proxies rely on it.
      child.parent?.removeChild(child)
      child.parent = this
      this.children.push(child)
    }

    removeChild(child: Container): void {
      const at = this.children.indexOf(child)
      if (at < 0) return
      gpu.mutations += 1
      child.parent = null
      this.children.splice(at, 1)
    }

    setSize(width: number, height: number): void {
      this.size = { width, height }
    }

    setMask(options: { mask: Container | null; channel?: string }): void {
      this.mask = options.mask
      this.maskChannel = options.channel ?? 'red'
    }

    setFromMatrix(matrix: Matrix): void {
      this.matrix = {
        a: matrix.a,
        b: matrix.b,
        c: matrix.c,
        d: matrix.d,
        tx: matrix.tx,
        ty: matrix.ty,
      }
    }

    removeChildren(): void {
      gpu.mutations += this.children.length
      for (const child of this.children) child.parent = null
      this.children.length = 0
    }

    /** Recorded, and passed down: `destroy({ children: true })` takes the subtree with it. */
    destroy(options?: { children?: boolean }): void {
      this.destroyed = true
      if (options?.children) for (const child of this.children) child.destroy(options)
    }
  }

  class Graphics extends Container {
    clear(): this {
      return this
    }
    moveTo(): this {
      return this
    }
    lineTo(): this {
      return this
    }
    circle(): this {
      return this
    }
    rect(): this {
      return this
    }
    fill(): this {
      return this
    }
  }

  return {
    Application: class {
      readonly canvas = document.createElement('canvas')
      readonly stage = new Container()
      readonly renderer = {
        render: (options?: { target?: { id: number } }) => {
          gpu.renders += 1
          if (options?.target) gpu.painted.push(options.target.id)
        },
        extract: {
          pixels: (options: {
            frame?: { x: number; y: number; width: number; height: number }
          }) => {
            if (options.frame) gpu.sampled.push(options.frame)
            return { pixels: gpu.pixels }
          },
          base64: (options: { frame?: unknown; resolution?: number }) => {
            gpu.extracted.push(options)
            return Promise.resolve('data:image/png;base64,QUJD')
          },
        },
      }

      async init(options: Record<string, unknown>): Promise<void> {
        gpu.init = options
      }
      destroy(): void {}
    },
    defaultFilterVert: '',
    Filter: {
      defaultOptions: { resolution: 1 },
      // What `Filter.from` builds, reduced to the one thing the engine writes into it.
      from: () => ({ resources: { adjustUniforms: { uniforms: {} } } }),
    },
    AlphaFilter: class {
      destroy(): void {}
    },
    /** What softens the edge of a dab: the engine writes a strength and a padding into it. */
    BlurFilter: class {
      strength = 0
      padding = 0
      destroy(): void {}
    },
    Container,
    Graphics,
    Matrix,
    Sprite: class extends Container {
      constructor() {
        super()
        // The world is private, so this registry is the only way a test can read what the
        // engine wrote onto a layer's sprite.
        gpu.sprites.push(this)
      }
    },
    Assets: {
      load: (options: { src: string; parser?: string }) => {
        gpu.loaded.push(options)
        if (gpu.refuseLoad) return Promise.reject(new Error('gone'))
        return Promise.resolve({ width: 200, height: 100 })
      },
    },
    Text: class extends Container {},
    // Carries its four numbers: the eyedropper's whole point is which frame it asks for.
    Rectangle: class {
      constructor(
        readonly x: number,
        readonly y: number,
        readonly width: number,
        readonly height: number,
      ) {}
    },
    Texture: class {},
    RenderTexture: {
      create: (options: { width: number; height: number }) => {
        const id = gpu.texturesCreated
        gpu.texturesCreated += 1
        return {
          id,
          width: options.width,
          height: options.height,
          // The patch store lifts sub-frames off it; what matters is that it is a stable object.
          source: {},
          destroy: () => {
            gpu.texturesDestroyed += 1
          },
        }
      },
    },
  }
})

const { BLEND_BY_MODE, CanvasEngine } = await import('./CanvasEngine')

type Harness = {
  engine: InstanceType<typeof CanvasEngine>
  host: HTMLElement
  viewports: Viewport[]
  /** Every selection the engine carved out, in the order it published them. */
  selections: CanvasSelection[]
  /** Where a caption was asked for, in document coordinates. */
  captions: Point[]
  /** The frames the engine settled a crop drag on, each of which becomes one history entry. */
  crops: Rect[]
  guides: { calls: string[] }
  /** The ids of the patches the engine reported as one finished gesture each. */
  patches: string[]
  /** The ids whose tiles the engine threw away: their history entry can no longer be replayed. */
  dropped: string[]
  /** `translate:<id>:<x>:<y>` and the two ends of the drag, in the order they arrived. */
  layers: string[]
  /** The families the engine asked the page for, in the order it asked. */
  faces: string[]
  /** Every colour the eyedropper handed back, packed as the document stores one. */
  picks: number[]
}

/**
 * A mounted engine with the brush armed. Explicit since the engine opens on the pointer, which
 * writes nothing: a test that presses to paint has to say which tool it is pressing with, and
 * the ones about another tool arm it themselves.
 */
function mounted(
  state: CanvasState = DEFAULT_CANVAS,
  tool: CanvasTool = 'brush',
  addFace?: FaceRegistrar,
): Promise<Harness> {
  const host = document.createElement('div')
  document.body.appendChild(host)

  const viewports: Viewport[] = []
  const selections: CanvasSelection[] = []
  const captions: Point[] = []
  const crops: Rect[] = []
  const calls: string[] = []
  const patches: string[] = []
  const dropped: string[] = []
  const layers: string[] = []
  const faces: string[] = []
  const picks: number[] = []
  const defaultFace: FaceRegistrar = async family => void faces.push(family)
  const harness: Harness = {
    engine: new CanvasEngine({
      onPick: color => picks.push(color),
      onPixels: patchId => patches.push(patchId),
      onPixelsDropped: patchId => dropped.push(patchId),
      onViewport: viewport => viewports.push(viewport),
      onSelection: selection => selections.push(selection),
      onText: at => captions.push(at),
      onCrop: rect => crops.push(rect),
      onHost: () => undefined,
      guides: {
        add: (axis, position) => {
          calls.push(`add:${axis}:${Math.round(position)}`)
          return 'guide-1'
        },
        move: (id, position) => calls.push(`move:${id}:${Math.round(position)}`),
        remove: id => calls.push(`remove:${id}`),
        beginDrag: () => calls.push('begin'),
        endDrag: () => calls.push('end'),
      },
      layers: {
        transform: (id, next) =>
          layers.push(
            `transform:${id}:${next.scaleX.toFixed(2)}:${next.scaleY.toFixed(2)}:${next.rotation.toFixed(2)}`,
          ),
        translate: (id, x, y) => layers.push(`translate:${id}:${Math.round(x)}:${Math.round(y)}`),
        beginDrag: () => layers.push('begin'),
        endDrag: () => layers.push('end'),
      },
      addFace: addFace ?? defaultFace,
    }),
    host,
    viewports,
    selections,
    captions,
    crops,
    guides: { calls },
    patches,
    dropped,
    layers,
    faces,
    picks,
  }

  mountedEngines.push(harness.engine)
  harness.engine.setView(DEFAULT_VIEW)
  harness.engine.setTool(tool)
  // The order React uses: the state is pushed while `mount` is still awaiting Pixi's `init`.
  harness.engine.apply(state)
  return harness.engine.mount(host).then(async () => {
    // Mounting frames the document, which books a frame and publishes a viewport. Draining both
    // and pinning the view at 1:1 is what lets a test name a screen coordinate and mean it.
    await nextFrame()
    // Magnetism off by default here: a guide laid 5 px from the frame would stick to its edge,
    // which is right, and would make every other assertion read 0. One test arms it back.
    harness.engine.setView({ ...VIEW_1_1, snap: false })
    viewports.length = 0
    return harness
  })
}

/** 1:1 and unpanned, so a screen coordinate in a test is a document coordinate. */
const VIEW_1_1 = { ...DEFAULT_VIEW, viewport: { x: 0, y: 0, scale: 1 } }

const nextFrame = (): Promise<void> =>
  new Promise(resolve => requestAnimationFrame(() => resolve()))

/** A picture is loaded without being awaited: nothing is drawn until the queue has drained. */
const flushMicrotasks = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

function press(host: HTMLElement, x: number, y: number, button = 0): void {
  host.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button }))
}

/**
 * What the overlay put on screen, in order: the rectangles it filled — the grips — and the
 * circles it traced — the brush ring. The overlay paints only when its canvas hands out a 2D
 * context, and `test-setup` denies one to the whole renderer, so lending it a recorder for the
 * length of one test is the only outlet this chrome has.
 */
function overlayRecorder(): { fills: number[][]; rings: number[][] } {
  const fills: number[][] = []
  const rings: number[][] = []
  const ignore = (): void => {}
  const context = {
    save: ignore,
    restore: ignore,
    setTransform: ignore,
    clearRect: ignore,
    beginPath: ignore,
    moveTo: ignore,
    lineTo: ignore,
    stroke: ignore,
    strokeRect: ignore,
    fillText: ignore,
    setLineDash: ignore,
    arc: (x: number, y: number, radius: number): void => {
      rings.push([x, y, radius])
    },
    fillRect: (x: number, y: number, width: number, height: number): void => {
      fills.push([x, y, width, height])
    },
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
  }

  const previous = HTMLCanvasElement.prototype.getContext
  // Same cast as `test-setup` makes to deny it: the overloads of `getContext` cannot be
  // satisfied by one function, and the overlay asks for its context in its constructor.
  HTMLCanvasElement.prototype.getContext = (() =>
    context) as unknown as HTMLCanvasElement['getContext']
  onTestFinished(() => {
    HTMLCanvasElement.prototype.getContext = previous
  })

  return { fills, rings }
}

/** How many tree mutations happen from here on, read when the assertion needs it. */
function mutationsCounted(): () => number {
  const before = gpu.mutations
  return () => gpu.mutations - before
}

/** A document made of exactly these layers, the bottom one armed. */
function stacked(layers: Layer[]): CanvasState {
  return { ...DEFAULT_CANVAS, layers, activeLayerId: firstPaintable(layers) }
}

/** The id a document opens armed on: a group swallows every stroke, so it is never one. */
function firstPaintable(layers: readonly Layer[]): string | null {
  for (const layer of layers) {
    if (!isGroup(layer)) return layer.id
    const inner = firstPaintable(layer.children)
    if (inner) return inner
  }
  return null
}

/** The container the engine built for a group, found by the label it puts on it. */
function groupContainer(id: string): Placed | undefined {
  return gpu.containers.find(container => container.label === id)
}

/**
 * Every engine a test mounted. They listen on `window` for `pointerup` and `keydown`, so one left
 * alive answers the next test's keys as well: a crop frame placed here and never applied was
 * being cropped by the ⏎ of the test after it.
 */
/** A harness whose page refuses every face, which is what a missing or unreadable file is. */
function mountedWithoutFace(): Promise<Harness> {
  return mounted(DEFAULT_CANVAS, 'brush', () => Promise.reject(new Error('no such file')))
}

const mountedEngines: InstanceType<typeof CanvasEngine>[] = []

afterEach(() => {
  for (const engine of mountedEngines) engine.dispose()
  mountedEngines.length = 0
})

beforeEach(() => {
  gpu.renders = 0
  gpu.texturesCreated = 0
  gpu.texturesDestroyed = 0
  gpu.mutations = 0
  gpu.init = {}
  gpu.sprites = []
  gpu.containers = []
  gpu.painted = []
  gpu.loaded = []
  gpu.extracted = []
  gpu.sampled = []
  gpu.pixels = [0, 0, 0, 0]
})

describe('the blend table', () => {
  // A mode missing from the table falls back to 'normal' silently: the layer composites wrongly
  // and nothing says so. Eleven of the sixteen did exactly that until the extension was imported.
  it('names each Pixi mode after the mode it stands for', () => {
    for (const mode of BLEND_MODES) {
      if (mode === 'hue') continue
      expect(BLEND_BY_MODE[mode]).toBe(mode)
    }
  })

  // Pixi 8.19 dropped 'hue' from its own union and ships no filter for it. The fallback is
  // deliberate, and written down so it is not read as an oversight.
  it('falls back to normal for the one mode Pixi no longer carries', () => {
    expect(BLEND_BY_MODE.hue).toBe('normal')
  })

  // The advanced modes read the back buffer. Without it WebGL warns once and composites normally.
  it('asks the renderer for the back buffer the advanced modes read from', async () => {
    await mounted()

    expect(gpu.init.useBackBuffer).toBe(true)
  })
})

describe('mounting', () => {
  // The regression this file was written for: React pushes the state before `init` resolves, so
  // the replay inside `mount` is the only thing that ever builds the first document's surfaces.
  it('builds a surface for a state pushed before the renderer existed', async () => {
    await mounted()

    expect(gpu.texturesCreated).toBe(1)
  })

  /**
   * `attach` is now the only thing that hangs a sprite in the world, and it only runs when the
   * placement changes. A signature kept across `dispose` made the replay find it unchanged, so a
   * remount onto the same engine rebuilt every texture and hung none of them.
   */
  it('hangs the document again after a dispose and a second mount', async () => {
    const { engine } = await mounted()
    engine.dispose()

    const second = document.createElement('div')
    document.body.appendChild(second)
    await engine.mount(second)

    expect(gpu.sprites.at(-1)?.parent).not.toBeNull()
  })

  it('builds one per paintable layer, groups excluded', async () => {
    await mounted({
      ...DEFAULT_CANVAS,
      layers: [pixelLayer('a', 'A'), pixelLayer('b', 'B')],
      activeLayerId: 'a',
    })

    expect(gpu.texturesCreated).toBe(2)
  })

  it('destroys the texture of a layer that left the stack', async () => {
    const { engine } = await mounted({
      ...DEFAULT_CANVAS,
      layers: [pixelLayer('a', 'A'), pixelLayer('b', 'B')],
      activeLayerId: 'a',
    })

    engine.apply({ ...DEFAULT_CANVAS, layers: [pixelLayer('a', 'A')], activeLayerId: 'a' })

    expect(gpu.texturesDestroyed).toBe(1)
  })

  /**
   * Dragging a layer rewrites `state.layers` sixty times a second without restacking it, and
   * rebuilding the tree for it would detach and reattach every sprite of the document per frame.
   */
  it('does not restack for a state whose layers are the same ones in the same order', async () => {
    const stack = [pixelLayer('a', 'A'), pixelLayer('b', 'B')]
    const { engine } = await mounted({ ...DEFAULT_CANVAS, layers: stack, activeLayerId: 'a' })
    const world = mutationsCounted()

    engine.apply({
      ...DEFAULT_CANVAS,
      layers: stack.map(layer => ({ ...layer, transform: { ...layer.transform, x: 20 } })),
      activeLayerId: 'a',
    })

    expect(world()).toBe(0)
  })

  it('restacks when the order actually changes', async () => {
    const stack = [pixelLayer('a', 'A'), pixelLayer('b', 'B')]
    const { engine } = await mounted({ ...DEFAULT_CANVAS, layers: stack, activeLayerId: 'a' })
    const world = mutationsCounted()

    engine.apply({ ...DEFAULT_CANVAS, layers: [...stack].reverse(), activeLayerId: 'a' })

    // Two detached and two reattached. The bound is the point: the pass this replaced was
    // quadratic in the surfaces, and a fifty-layer document felt it.
    expect(world()).toBe(4)
  })

  // A guide drag rewrites the state on every pointer move and touches no pixel.
  it('does not walk the stack again for a state whose layers are the same', async () => {
    const { engine } = await mounted()
    const renders = gpu.renders

    engine.apply({ ...DEFAULT_CANVAS, guides: [{ id: 'g', axis: 'x', position: 10 }] })

    expect(gpu.texturesCreated).toBe(1)
    expect(gpu.renders).toBe(renders)
  })
})

describe('groups', () => {
  const grouped = (children: Layer[]): CanvasState => stacked([groupLayer('g', 'G', children)])

  it('builds a container of its own and nests the surfaces inside it', async () => {
    await mounted(grouped([pixelLayer('a', 'A'), pixelLayer('b', 'B')]))

    expect(groupContainer('g')?.children).toHaveLength(2)
  })

  // A group has no pixels of its own: allocating it a texture would be a document-sized waste.
  it('costs no texture', async () => {
    await mounted(grouped([pixelLayer('a', 'A')]))

    expect(gpu.texturesCreated).toBe(1)
  })

  /**
   * The known regression: a surface judged missing here is a texture destroyed on the GPU, and
   * grouping two painted layers used to lose their pixels outright.
   */
  it('keeps both textures when two layers are gathered into one', async () => {
    const stack = [pixelLayer('a', 'A'), pixelLayer('b', 'B')]
    const { engine } = await mounted({ ...DEFAULT_CANVAS, layers: stack, activeLayerId: 'a' })

    engine.apply(grouped(stack))

    expect(gpu.texturesDestroyed).toBe(0)
    expect(gpu.texturesCreated).toBe(2)
  })

  // A group at 50% used to leave its children at 100%: the whole point of a group is that it
  // composites its subtree, not that it passes the stack through.
  it('carries its own visibility, opacity and blend mode', async () => {
    const group: Layer = {
      ...groupLayer('g', 'G', [pixelLayer('a', 'A')]),
      opacity: 0.5,
      visible: false,
      blend: 'multiply',
    }
    await mounted({ ...DEFAULT_CANVAS, layers: [group], activeLayerId: 'a' })

    expect(groupContainer('g')).toMatchObject({ alpha: 0.5, visible: false, blendMode: 'multiply' })
  })

  // Isolation is an offscreen pass, and a neutral filter is how v8 asks for one.
  it('isolates only the group that asks for it', async () => {
    const passing = groupLayer('g', 'G', [pixelLayer('a', 'A')])
    const { engine } = await mounted(stacked([passing]))
    expect(groupContainer('g')?.filters).toEqual([])

    engine.apply(stacked([{ ...passing, isolation: 'isolate' }]))
    expect(groupContainer('g')?.filters).toHaveLength(1)
  })

  /**
   * A container's `blendMode` is only inherited, and every child overwrites it with its own; its
   * `alpha` multiplies per child, so two overlapping layers showed through each other. Both only
   * mean what they say once the subtree is composited offscreen.
   */
  it('composites offscreen as soon as its blend or its opacity would show', async () => {
    const plain = groupLayer('g', 'G', [pixelLayer('a', 'A')])
    const { engine } = await mounted(stacked([plain]))
    expect(groupContainer('g')?.filters).toEqual([])

    engine.apply(stacked([{ ...plain, blend: 'multiply' }]))
    expect(groupContainer('g')?.filters).toHaveLength(1)

    engine.apply(stacked([{ ...plain, opacity: 0.5 }]))
    expect(groupContainer('g')?.filters).toHaveLength(1)

    engine.apply(stacked([plain]))
    expect(groupContainer('g')?.filters).toEqual([])
  })

  it('drops the container of a group that left the stack', async () => {
    const { engine } = await mounted(grouped([pixelLayer('a', 'A')]))

    engine.apply({ ...DEFAULT_CANVAS, layers: [pixelLayer('a', 'A')], activeLayerId: 'a' })

    expect(groupContainer('g')?.children).toHaveLength(0)
  })
})

describe('clipping', () => {
  const clipped = (id: string): Layer => ({ ...layerFixture({ id, name: id }), clipped: true })

  /**
   * An object cannot be both the picture and the stencil, so each clipped layer gets a proxy of
   * its own onto the base's texture. Three clipped on one base means three proxies, all visible.
   */
  it('gives every clipped layer of a run its own stencil onto the same base', async () => {
    await mounted(stacked([pixelLayer('base', 'Base'), clipped('a'), clipped('b'), clipped('c')]))

    // Four layers, then three proxies: seven sprites, four textures.
    expect(gpu.sprites).toHaveLength(7)
    expect(gpu.texturesCreated).toBe(4)

    const proxies = gpu.sprites.slice(4)
    for (const proxy of proxies) expect(proxy.parent?.mask).toBe(proxy)
    expect(new Set(proxies).size).toBe(3)
  })

  /**
   * Pixi reads the red channel of a sprite mask by default, which its own docs point out. What
   * cuts a clipped layer out is where the base has pixels, not how red they are: a base painted
   * pure blue cut out nothing at all.
   */
  it('cuts on the coverage of the base, not on how red it is', async () => {
    await mounted(stacked([pixelLayer('base', 'Base'), clipped('a')]))

    const proxy = gpu.sprites.at(-1)
    expect(proxy?.parent?.maskChannel).toBe('alpha')
  })

  it('leaves an unclipped stack without a single stencil', async () => {
    await mounted(stacked([pixelLayer('a', 'A'), pixelLayer('b', 'B')]))

    expect(gpu.sprites).toHaveLength(2)
  })

  // A clipped layer with nothing under it is not clipped at all: hiding it would lose its pixels.
  it('builds no stencil for a clipped layer with no base under it', async () => {
    await mounted(stacked([clipped('a'), pixelLayer('b', 'B')]))

    expect(gpu.sprites).toHaveLength(2)
  })

  it('drops the stencil once the layer stops being clipped', async () => {
    const stack = [pixelLayer('base', 'Base'), clipped('a')]
    const { engine } = await mounted(stacked(stack))
    expect(gpu.sprites).toHaveLength(3)

    engine.apply(stacked([pixelLayer('base', 'Base'), pixelLayer('a', 'a')]))

    expect(gpu.sprites.at(-1)?.parent).toBeNull()
  })

  // A stencil is only as strong as the base it stands for: hiding the base used to leave the
  // layers clipped to it floating at full strength over nothing.
  it('takes the visibility and the opacity of the base along with its place', async () => {
    const base = { ...pixelLayer('base', 'Base'), visible: false, opacity: 0.4 }
    await mounted(stacked([base, clipped('a')]))

    const proxy = gpu.sprites.at(-1)
    expect(proxy).toMatchObject({ visible: false, alpha: 0.4 })
  })

  // A stencil a frame behind the layer it cuts would show a seam down the side of it.
  it('moves the stencil with the base it stands for', async () => {
    const base = pixelLayer('base', 'Base')
    const stack = [base, clipped('a')]
    const { engine } = await mounted(stacked(stack))

    engine.apply(
      stacked([{ ...base, transform: { ...IDENTITY, x: 30, y: 70 } }, clipped('a'), clipped('b')]),
    )

    const proxy = gpu.sprites.find(sprite => sprite.parent?.mask === sprite)
    expect(proxy?.position).toMatchObject({ x: 30 + 512, y: 70 + 512 })
  })

  // A clipped layer that also carries a mask needs two, and an object holds one.
  it('lets a clipped layer keep a mask of its own', async () => {
    const masked: Layer = {
      ...pixelLayer('a', 'A'),
      clipped: true,
      mask: { enabled: true, linked: true },
    }
    await mounted(stacked([pixelLayer('base', 'Base'), masked]))

    const sprite = gpu.sprites[1]
    expect(sprite?.mask).not.toBeNull()
    expect(sprite?.parent?.mask).not.toBe(sprite?.mask)
  })
})

describe('fill opacity', () => {
  // No layer effect exists yet, so for now the two simply multiply. The distinction is written
  // down in the engine so it is not lost the day effects arrive.
  it('fades the pixels alongside the layer opacity', async () => {
    const layer: Layer = { ...pixelLayer('layer-1', 'Background'), opacity: 0.5, fillOpacity: 0.5 }
    await mounted({ ...DEFAULT_CANVAS, layers: [layer], activeLayerId: 'layer-1' })

    expect(gpu.sprites[0]?.alpha).toBe(0.25)
  })
})

describe('layer masks', () => {
  const withMask = (mask?: { enabled: boolean; linked: boolean }): CanvasState =>
    stacked([{ ...pixelLayer('layer-1', 'Background'), mask }])

  // A mask per layer allocated ahead would double the GPU memory of every document.
  it('costs nothing at all on a layer that carries no mask', async () => {
    await mounted(withMask())

    expect(gpu.texturesCreated).toBe(1)
  })

  it('gives a masked layer a texture and a sprite of its own', async () => {
    await mounted(withMask({ enabled: true, linked: true }))

    expect(gpu.texturesCreated).toBe(2)
    expect(gpu.sprites[0]?.mask).toBe(gpu.sprites[1])
  })

  // Unticking the box hides a mask; it does not erase it. The pixels are the point of the toggle.
  it('takes a disabled mask off the sprite while keeping its pixels', async () => {
    const { engine } = await mounted(withMask({ enabled: true, linked: true }))

    engine.apply(withMask({ enabled: false, linked: true }))

    expect(gpu.sprites[0]?.mask).toBeNull()
    expect(gpu.texturesDestroyed).toBe(0)
  })

  // A mask is born revealing everything. Left cleared, ticking the box made the layer vanish
  // whole, and there was no way to bring it back but to flood the mask by hand.
  it('reveals the whole layer until something is painted into it', async () => {
    const { engine } = await mounted(withMask())
    gpu.painted = []

    engine.apply(withMask({ enabled: true, linked: true }))

    // The second texture is the mask, and it is filled at birth like a new document's page.
    expect(gpu.painted).toContain(1)
  })

  it('frees the mask texture when the mask itself leaves the state', async () => {
    const { engine } = await mounted(withMask({ enabled: true, linked: true }))

    engine.apply(withMask())

    expect(gpu.texturesDestroyed).toBe(1)
  })

  /**
   * The texture is allocated on the mask's presence, so the placement has to encode presence too.
   * Keyed on `enabled` alone, removing a disabled mask left the string unchanged, the drop pass
   * never ran, and a later mask was handed the old one's pixels back.
   */
  it('frees it just the same when the mask it drops was disabled', async () => {
    const { engine } = await mounted(withMask({ enabled: false, linked: true }))
    expect(gpu.texturesCreated).toBe(2)

    engine.apply(withMask())

    expect(gpu.texturesDestroyed).toBe(1)
  })

  // Unlinked means the mask does not follow the layer: it stays where it was painted.
  it('leaves an unlinked mask behind when the layer moves', async () => {
    const moved = { ...IDENTITY, x: 40, y: 60 }
    await mounted({
      ...DEFAULT_CANVAS,
      layers: [
        {
          ...pixelLayer('layer-1', 'Background'),
          transform: moved,
          mask: { enabled: true, linked: false },
        },
      ],
      activeLayerId: 'layer-1',
    })

    expect(gpu.sprites[0]?.position).toMatchObject({ x: 40 + 512, y: 60 + 512 })
    expect(gpu.sprites[1]?.position).toMatchObject({ x: 512, y: 512 })
  })
})

/**
 * A layer's pixels are its own; the sprite that shows them carries the layer's transform. A dab
 * drawn where the cursor is therefore has to be mapped back, or it lands displaced by exactly
 * that transform — which is what made the brush miss after a crop, `resizeCanvas` shifting every
 * transform by the crop's offset.
 */
describe('painting a transformed layer', () => {
  /** The one node the engine puts a matrix on is the space a pass is drawn through. */
  const paintSpace = (): Placed | undefined => gpu.containers.find(container => container.matrix)

  const shifted = (transform: Partial<Transform>): CanvasState =>
    stacked([{ ...pixelLayer('layer-1', 'Background'), transform: { ...IDENTITY, ...transform } }])

  /**
   * A dab, closed. The release matters: `pointerup` is listened for on the window, so a gesture
   * left open outlives its test and is ended by the next one's release — which photographs its
   * tiles into the run that is measuring.
   */
  function dabAt(host: HTMLElement, x: number, y: number): void {
    press(host, x, y)
    release(x, y)
  }

  /** The box a stroke reports to the undo, in surface pixels. */
  const reachOf = (
    host: HTMLElement,
    at: { x: number; y: number } = { x: 200, y: 200 },
  ): { x: number; y: number; width: number; height: number } | undefined => {
    const touched = vi.spyOn(PixelPatches.prototype, 'touch')
    onTestFinished(() => touched.mockRestore())
    touched.mockClear()
    dabAt(host, at.x, at.y)
    return touched.mock.calls[0]?.[0]
  }

  /** The stamp is the one thing `paintSpace` carries into a surface. */
  const stamp = (): Placed | undefined => paintSpace()?.children[0]

  /**
   * The reach, not the disc. A soft brush lays pixels beyond its own radius — that fringe IS the
   * soft edge — and a stroke whose undo footprint was the radius alone would put back everything
   * except what the softness had just drawn.
   */
  it('reaches past the disc when the edge is soft, and stops at it when it is hard', async () => {
    const { host, engine } = await mounted(shifted({}))

    engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 1 })
    const hard = reachOf(host)

    engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })
    const soft = reachOf(host)

    // 40 across, plus the pixel of slack `brushRect` already keeps for the antialiased rim.
    expect(hard).toMatchObject({ width: 42, height: 42 })
    // Ten pixels of spread, and the filter's padding is twice that on each side.
    expect(soft).toMatchObject({ width: 82, height: 82 })
    // The box grows on both sides, so its origin moves back by exactly what its width gained.
    expect((hard?.x ?? 0) - (soft?.x ?? 0)).toBe(20)
    expect((hard?.y ?? 0) - (soft?.y ?? 0)).toBe(20)
  })

  /**
   * The fringe is counted in surface pixels and the disc in document ones. Added before the
   * mapping, a layer scaled 2× recorded half the box its own stroke covered — and an undo left
   * the fringe on screen. The one state the other cases never reach, being pure translations.
   */
  it('reports the fringe in the surface’s pixels, not the document’s', async () => {
    const { host, engine } = await mounted(shifted({ scaleX: 2, scaleY: 2 }))
    engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })

    const reach = reachOf(host)

    // The disc maps to 20 surface px across; the filter's padding is 20 surface px each side.
    expect(reach).toMatchObject({ width: 61, height: 61 })
  })

  /**
   * The pencil reads the same settings and spreads none of them: that is the whole difference.
   *
   * The eraser goes with it, and for Pixi's reason rather than a promise of the tool — see
   * `softness()`. Both rows are `BRUSH_SETTINGS_BY_TOOL`, which the bar reads to hide the
   * slider: this is the measurement that keeps the table honest about the one column the engine
   * asks it for.
   */
  it.each<CanvasTool>(['pencil', 'eraser'])(
    'reaches no further under the %s, whatever the hardness slider says',
    async tool => {
      const { host, engine } = await mounted(shifted({}))
      engine.setTool(tool)
      engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })

      expect(reachOf(host)).toMatchObject({ width: 42 })
    },
  )

  /**
   * What the reach is computed from. Without this the filter could stop being hung at all and
   * every assertion above would still pass: they read `softness()`, never the filter it sets.
   */
  describe('the filter that softens the edge', () => {
    it('is hung, at the spread the brush asks for', async () => {
      const { host, engine } = await mounted(shifted({}))
      engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })
      dabAt(host, 200, 200)

      expect(stamp()?.filters).toHaveLength(1)
      expect(stamp()?.filters[0]).toMatchObject({ strength: 10, padding: 20 })
    })

    it('is taken off for an edge that is already hard', async () => {
      const { host, engine } = await mounted(shifted({}))
      engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })
      dabAt(host, 200, 200)
      engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 1 })

      expect(stamp()?.filters).toEqual([])
    })

    /**
     * Arming the pencil from the toolbar calls `setTool` alone — `setBrush` does not follow. The
     * filter left hanging would paint a feathered pencil while the undo box believed it hard.
     */
    it('is taken off by arming the pencil, with no setting touched', async () => {
      const { host, engine } = await mounted(shifted({}))
      engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })
      dabAt(host, 200, 200)

      engine.setTool('pencil')

      expect(stamp()?.filters).toEqual([])
    })

    /**
     * A filtered container is drawn into a texture of its own and composed back with the
     * filter's blend mode, never the stamp's — so an `erase` stamp under a filter rubs out
     * against nothing. The eraser stays hard until that can be checked on a GPU.
     */
    it('is never hung under the eraser, whose blend would not survive it', async () => {
      const { host, engine } = await mounted(shifted({}))
      engine.setTool('eraser')
      engine.setBrush({ ...DEFAULT_BRUSH, size: 40, hardness: 0 })
      dabAt(host, 200, 200)

      expect(stamp()?.filters).toEqual([])
    })
  })

  it('draws straight into the pixels of an untouched layer', async () => {
    const { host } = await mounted(shifted({}))

    dabAt(host, 200, 200)

    const matrix = paintSpace()?.matrix
    expect(matrix).toBeDefined()
    // Signed zeroes come out of the inverse, and `toMatchObject` tells -0 from 0.
    expect(matrix?.a).toBeCloseTo(1, 10)
    expect(matrix?.d).toBeCloseTo(1, 10)
    expect(matrix?.tx).toBeCloseTo(0, 10)
    expect(matrix?.ty).toBeCloseTo(0, 10)
  })

  it('takes the move back out before it writes', async () => {
    const { host } = await mounted(shifted({ x: 50, y: 30 }))

    dabAt(host, 200, 200)

    // The stroke is aimed at document (200, 200); the layer's pixel under it is (150, 170).
    expect(paintSpace()?.matrix?.tx).toBeCloseTo(-50, 10)
    expect(paintSpace()?.matrix?.ty).toBeCloseTo(-30, 10)
  })

  it('takes a scale back out too, so a stroke keeps the width the bar shows', async () => {
    const { host } = await mounted(shifted({ scaleX: 2, scaleY: 2 }))

    dabAt(host, 200, 200)

    expect(paintSpace()?.matrix?.a).toBeCloseTo(0.5, 10)
    expect(paintSpace()?.matrix?.d).toBeCloseTo(0.5, 10)
  })

  it('declines the stroke on a layer crushed onto a line', async () => {
    // A singular map has no inverse, and painting through one writes NaN across the whole
    // texture — which no undo brings back. Nothing at all is the only safe answer.
    const { host, patches } = await mounted(shifted({ scaleX: 0 }))
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(gpu.painted).toEqual([])
    expect(patches).toEqual([])
  })

  it('keeps the stroke on the surface it started on', async () => {
    // The map is taken once, when the hand comes down. Re-deriving it per move would re-resolve
    // the armed layer, and a stroke would change surface mid-drag.
    const { engine, host } = await mounted(shifted({ x: 50, y: 30 }))

    press(host, 200, 200)
    engine.apply(shifted({ x: 400, y: 400 }))
    drag(host, 240, 240)
    release(240, 240)

    expect(paintSpace()?.matrix?.tx).toBeCloseTo(-50, 10)
    expect(paintSpace()?.matrix?.ty).toBeCloseTo(-30, 10)
  })

  it('paints an unlinked mask in its own space, where it was left', async () => {
    // Unlinked means the mask does not follow the layer, so the way back to its pixels is not
    // the layer's transform but the identity.
    const { engine, host } = await mounted(
      stacked([
        {
          ...pixelLayer('layer-1', 'Background'),
          transform: { ...IDENTITY, x: 50, y: 30 },
          mask: { enabled: true, linked: false },
        },
      ]),
    )
    engine.setPaintTarget('mask')

    dabAt(host, 200, 200)

    expect(paintSpace()?.matrix?.tx).toBeCloseTo(0, 10)
    expect(paintSpace()?.matrix?.ty).toBeCloseTo(0, 10)
  })
})

/**
 * Merging and flattening record that layers became one; the pixels are the engine's to compose,
 * and there is exactly one moment it can — before the command drops what they are made of.
 */
describe('composing a merge and a flatten', () => {
  const paintSpace = (): Placed | undefined => gpu.containers.find(container => container.matrix)

  const twoLayers = (transform: Partial<Transform> = {}): CanvasState =>
    stacked([
      pixelLayer('below', 'Below'),
      { ...pixelLayer('above', 'Above'), transform: { ...IDENTITY, ...transform } },
    ])

  /** The layers are built bottom first, so the lower one owns texture 0. */
  const BELOW = 0

  it('draws the upper layer into the lower one, which is the texture the merge keeps', async () => {
    const { engine } = await mounted(twoLayers())
    gpu.painted = []

    engine.mergeInto('below', 'above')

    expect(gpu.painted).toContain(BELOW)
  })

  it('carries the upper layer through the document and back into the lower one', async () => {
    const { engine } = await mounted(twoLayers({ x: 40, y: 25 }))

    engine.mergeInto('below', 'above')

    // The upper layer sits 40 by 25 further along; the lower one has not moved, so its pixels
    // must receive the picture at that same offset rather than at the origin.
    expect(paintSpace()?.matrix?.tx).toBeCloseTo(40, 10)
    expect(paintSpace()?.matrix?.ty).toBeCloseTo(25, 10)
  })

  it('composes nothing when either layer has no surface', async () => {
    const { engine } = await mounted(twoLayers())
    gpu.painted = []

    engine.mergeInto('below', 'gone')

    expect(gpu.painted).toEqual([])
  })

  it('hands the flattened picture to the layer that replaces the stack', async () => {
    const { engine } = await mounted(twoLayers())

    // Composed while the stack still exists, held for a layer that does not exist yet.
    engine.flattenInto('flat')
    const built = gpu.texturesCreated
    gpu.painted = []
    engine.apply(stacked([pixelLayer('flat', 'Background')]))

    // The new surface is built, then the held picture is poured into it: born empty, the
    // document would come out transparent, which is what kept Flatten off the menu.
    expect(gpu.painted).toContain(built)
  })

  it('leaves a layer that was not flattened into alone', async () => {
    const { engine } = await mounted(twoLayers())

    engine.flattenInto('flat')
    const built = gpu.texturesCreated
    gpu.painted = []
    engine.apply(stacked([pixelLayer('other', 'Other')]))

    expect(gpu.painted).not.toContain(built)
  })
})

/**
 * A texture used to be allocated once, at whatever size the document had when its layer was
 * born, and never grew. Five features were written against that and left unoffered for it: crop,
 * mirror, quarter turn, merge down and flatten.
 */
describe('following the document to another size', () => {
  const masked: CanvasState = {
    ...DEFAULT_CANVAS,
    layers: [{ ...pixelLayer('layer-1', 'Background'), mask: { enabled: true, linked: true } }],
    activeLayerId: 'layer-1',
  }

  const resizedTo = (state: CanvasState, width: number, height: number): CanvasState => ({
    ...state,
    width,
    height,
    // A fresh array, since `apply` skips a state whose stack it already holds.
    layers: [...state.layers],
  })

  it('rebuilds the layer and its mask, and frees what they replace', async () => {
    const { engine } = await mounted(masked)
    const builtBefore = gpu.texturesCreated
    const freedBefore = gpu.texturesDestroyed

    engine.apply(resizedTo(masked, 512, 512))

    // Two surfaces, so two textures out and two in. A mask left behind is a layer hidden by a
    // stencil one document old.
    expect(gpu.texturesCreated - builtBefore).toBe(2)
    expect(gpu.texturesDestroyed - freedBefore).toBe(2)
  })

  it('carries the old picture into each new surface', async () => {
    const { engine } = await mounted(masked)
    const first = gpu.texturesCreated
    gpu.painted = []

    engine.apply(resizedTo(masked, 512, 512))

    // Rebuilt and left empty would lose the stack outright; the copy is what makes it a resize.
    expect(gpu.painted).toContain(first)
    expect(gpu.painted).toContain(first + 1)
  })

  it('leaves the surfaces alone when the frame keeps its size', async () => {
    const { engine } = await mounted(masked)
    const freedBefore = gpu.texturesDestroyed

    engine.apply({ ...masked, layers: [...masked.layers] })

    expect(gpu.texturesDestroyed).toBe(freedBefore)
  })

  it('throws the undo tiles away, and says which ones', async () => {
    // A capture names its tile in the surface's own coordinates. Once the surface is another
    // shape those coordinates point elsewhere, so replaying one would paint sideways.
    const { engine, host, patches, dropped } = await mounted(masked)
    press(host, 200, 200)
    drag(host, 240, 240)
    release()
    const recorded = patches[0]
    expect(recorded).toBeDefined()

    engine.apply(resizedTo(masked, 512, 512))

    expect(dropped).toEqual([recorded])
  })
})

/**
 * The stencil holder is rebuilt per pass and the old one freed with its children. The brush's
 * stamp is not one of its children to keep — it is built once, with the engine, and lives as long
 * as it does.
 */
describe('the stencil holder and the stamp it borrows', () => {
  const paintSpace = (): Placed | undefined => gpu.containers.find(container => container.matrix)

  /** With nothing selected the stamp goes straight into the paint space: that is how it is found. */
  function stampAfterAPlainDab(host: HTMLElement): Placed {
    press(host, 200, 200)
    release(200, 200)
    const stamp = paintSpace()?.children[0]
    if (!stamp) throw new Error('a dab always draws through the paint space')
    return stamp
  }

  it('keeps the stamp alive when a selection is dropped between two strokes', async () => {
    const { engine, host } = await mounted()
    const stamp = stampAfterAPlainDab(host)

    // Inside a marquee the stamp is reparented into a holder, which is what the stencil masks.
    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 100, height: 100 } })
    press(host, 50, 50)
    release(50, 50)

    // Deselecting frees that holder. The stamp must not go with it, or the brush is dead for
    // the rest of the session: it is built once and never rebuilt.
    engine.setSelection(null)
    press(host, 200, 200)
    release(200, 200)

    expect(stamp.destroyed).toBe(false)
  })

  it('keeps the stamp alive when another tool borrows the stencil next', async () => {
    const { engine, host } = await mounted()
    const stamp = stampAfterAPlainDab(host)

    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 100, height: 100 } })
    press(host, 50, 50)
    release(50, 50)

    // The bucket cuts on the same stencil, and hands `clipped` a sheet of its own: the holder
    // holding the stamp is freed by a pass the stamp is not part of.
    engine.setTool('fill')
    press(host, 60, 60)
    release(60, 60)

    expect(stamp.destroyed).toBe(false)
  })
})

describe('painting into a mask', () => {
  const masked: CanvasState = {
    ...DEFAULT_CANVAS,
    layers: [{ ...pixelLayer('layer-1', 'Background'), mask: { enabled: true, linked: true } }],
    activeLayerId: 'layer-1',
  }

  /** The layer's texture is built first, its mask second. */
  const LAYER = 0
  const MASK = 1

  it('writes to the layer while the brush is aimed at its pixels', async () => {
    const { host } = await mounted(masked)
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(gpu.painted).toContain(LAYER)
    expect(gpu.painted).not.toContain(MASK)
  })

  it('writes to the mask once the brush is aimed at it', async () => {
    const { engine, host } = await mounted(masked)
    engine.setPaintTarget('mask')
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(gpu.painted).toContain(MASK)
    expect(gpu.painted).not.toContain(LAYER)
  })

  it('files the undo patch against the mask, so the stroke can be taken back', async () => {
    const { engine, host, patches } = await mounted(masked)
    engine.setPaintTarget('mask')

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    const patchId = patches[0]
    expect(patchId).toBeDefined()
    gpu.painted = []
    expect(engine.restorePixels(patchId ?? '', 'before')).toBe(true)
    expect(gpu.painted).toContain(MASK)
  })

  // A layer with no mask has nothing to paint into: the stroke lands nowhere rather than on it.
  it('paints nothing when the layer aimed at carries no mask', async () => {
    const { engine, host, patches } = await mounted()
    engine.setPaintTarget('mask')
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(gpu.painted).toEqual([])
    expect(patches).toEqual([])
  })
})

describe('loading a picture into a layer', () => {
  const URL = 'scenario://asset/take-1'

  it('draws it into the texture of the layer it names', async () => {
    const { engine } = await mounted(stacked([pixelLayer('a', 'A'), pixelLayer('b', 'B')]))
    gpu.painted = []

    await engine.loadInto('b', URL)

    expect(gpu.painted).toEqual([1])
  })

  // The scheme carries no extension, so nothing in the URL tells Pixi what to make of it.
  it('names the parser, which the scheme cannot tell Pixi by itself', async () => {
    const { engine } = await mounted()

    await engine.loadInto('layer-1', URL)

    expect(gpu.loaded).toEqual([{ src: URL, parser: 'texture' }])
  })

  it('lays it inside the document without deforming it', async () => {
    const { engine } = await mounted()

    await engine.loadInto('layer-1', URL)

    // 200×100 in a 1024² document: it already fits, so it keeps its size and is centred.
    const laid = gpu.sprites.at(-1)
    expect(laid?.size).toEqual({ width: 200, height: 100 })
    expect(laid?.position).toMatchObject({ x: 412, y: 462 })
  })

  /**
   * The seam a whole layer of tests used to straddle: the engine hears about a layer one React
   * commit after the store took it, so a picture drawn at the moment of the drop landed nowhere
   * at all. It is drawn when the surface is built, which is the first moment there is one.
   */
  it('draws what a layer carries as soon as it builds its surface', async () => {
    const laid = { ...pixelLayer('a', 'A'), source: 'asset-7' }
    const { engine } = await mounted()
    gpu.loaded = []

    engine.apply(stacked([pixelLayer('layer-1', 'Background'), laid]))
    await flushMicrotasks()

    expect(gpu.loaded).toEqual([{ src: 'scenario://asset/asset-7', parser: 'texture' }])
  })

  // Once, when it is born: redrawing on every state would repaint over what has been painted.
  it('draws it once, not on every state that mentions the layer', async () => {
    const laid = { ...pixelLayer('a', 'A'), source: 'asset-7' }
    const { engine } = await mounted(stacked([laid]))
    await flushMicrotasks()
    gpu.loaded = []

    engine.apply(stacked([{ ...laid, opacity: 0.5 }]))
    await flushMicrotasks()

    expect(gpu.loaded).toEqual([])
  })

  it('does nothing at all for a layer it does not hold', async () => {
    const { engine } = await mounted()
    gpu.painted = []

    await expect(engine.loadInto('never-built', URL)).resolves.toBeUndefined()
    expect(gpu.painted).toEqual([])
  })

  // Drawing into a texture the GPU has already freed is an error, not a no-op.
  it('drops the picture when the document closed while it was in flight', async () => {
    const { engine } = await mounted()
    const loading = engine.loadInto('layer-1', URL)
    engine.dispose()
    gpu.painted = []

    await loading

    expect(gpu.painted).toEqual([])
  })
})

describe('carving out a selection', () => {
  it('publishes a box drawn between the two corners of a drag', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')

    press(host, 100, 100)
    drag(host, 300, 200)
    release()
    await nextFrame()

    expect(selections.at(-1)).toEqual({
      kind: 'rect',
      rect: { x: 100, y: 100, width: 200, height: 100 },
    })
  })

  it('draws an ellipse when that is the armed mode', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')
    engine.setSelectionShape('ellipse')

    press(host, 100, 100)
    drag(host, 300, 200)
    await nextFrame()

    expect(selections.at(-1)?.kind).toBe('ellipse')
  })

  // A lasso follows the hand rather than spanning a box: every move adds a point.
  it('grows a lasso point by point', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')
    engine.setSelectionShape('lasso')

    press(host, 100, 100)
    drag(host, 120, 130)
    drag(host, 160, 180)
    await nextFrame()

    const last = selections.at(-1)
    expect(last?.kind).toBe('lasso')
    expect(last?.kind === 'lasso' && last.points).toHaveLength(4)
  })

  // The three modes are one tool; only the bar knows which gesture is armed.
  it('draws whatever shape was armed last', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')
    engine.setSelectionShape('lasso')
    engine.setSelectionShape('rect')

    press(host, 120, 120)
    drag(host, 160, 160)
    await nextFrame()

    expect(selections.at(-1)?.kind).toBe('rect')
  })

  /**
   * The one that bricked the document: a click carved a zero-area rectangle, which is a stencil
   * nothing gets through — and every later stroke wrote nothing while looking like a broken
   * brush, with nowhere in the app to deselect from.
   */
  it('drops a selection a click carved nothing out of', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')

    press(host, 200, 200)
    release()
    await nextFrame()

    expect(selections.at(-1)).toBeNull()
  })

  // A drag that did carve something out survives the pointer coming up.
  it('keeps one a drag actually made', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')

    press(host, 200, 200)
    drag(host, 260, 260)
    release()
    await nextFrame()

    expect(selections.at(-1)).not.toBeNull()
  })

  // Sixty pointer moves in a second must not be sixty React commits — the viewport's own rule.
  it('tells React once a frame rather than once per pointer move', async () => {
    const { engine, host, selections } = await mounted()
    engine.setTool('select')

    press(host, 200, 200)
    for (const x of [210, 220, 230]) drag(host, x, 240)

    expect(selections).toEqual([])
    await nextFrame()
    expect(selections).toHaveLength(1)
  })
})

describe('painting inside a selection', () => {
  /** How many objects the engine handed the renderer for the last pass. */
  const stencilled = (): boolean => gpu.containers.some(container => container.mask !== null)

  it('paints straight onto the layer when nothing is selected', async () => {
    const { host } = await mounted()
    gpu.containers = []

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(stencilled()).toBe(false)
  })

  // Cut on the GPU rather than tested per dab: the shape is a stencil.
  it('cuts the stroke to the selection when there is one', async () => {
    const { engine, host } = await mounted()
    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 100, height: 100 } })
    gpu.containers = []

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(stencilled()).toBe(true)
  })

  /**
   * The bucket stops at the selection; a surface being born never does. A mask is born white,
   * and one born white inside a marquee and transparent outside would hide its layer everywhere
   * else the moment it appeared.
   */
  it('never cuts the fill a surface is born with', async () => {
    const { engine } = await mounted()
    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 10, height: 10 } })
    gpu.containers = []

    engine.apply(stacked([pixelLayer('layer-1', 'Background'), pixelLayer('b', 'B', 0xffffff)]))

    expect(gpu.containers.some(container => container.mask !== null)).toBe(false)
  })

  it('cuts the bucket the same way, which is what makes it fill a region', async () => {
    const { engine, host } = await mounted()
    engine.setTool('fill')
    engine.setSelection({ kind: 'ellipse', rect: { x: 0, y: 0, width: 100, height: 100 } })
    gpu.containers = []

    press(host, 200, 200)

    expect(stencilled()).toBe(true)
  })
})

describe('making a mask of a selection', () => {
  const masked = (): CanvasState =>
    stacked([{ ...pixelLayer('layer-1', 'Background'), mask: { enabled: true, linked: true } }])

  it('paints the region into a mask that already exists', async () => {
    const { engine } = await mounted(masked())
    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 40, height: 40 } })
    gpu.painted = []

    engine.fillMaskFromSelection('layer-1')

    // The second texture is the mask, and `clear: true` says the region replaces what was there.
    expect(gpu.painted).toContain(1)
  })

  /**
   * The seam again: the command that gives a layer its mask writes into the store, and the
   * surface only follows one React commit later. Asked for it before then, the engine held the
   * region rather than dropping it — otherwise the mask came out uniformly white.
   */
  it('holds the region until the mask it was asked for exists', async () => {
    const { engine } = await mounted()
    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 40, height: 40 } })

    engine.fillMaskFromSelection('layer-1')
    gpu.painted = []
    engine.apply(masked())

    // Twice into the mask: the white it is born with, then the region that was waiting. Once
    // only would mean the region was dropped on the floor.
    expect(gpu.painted.filter(id => id === 1)).toHaveLength(2)
  })

  // What a click meant must not change because the pointer moved in between.
  it('paints the region it was asked for, not the one selected by then', async () => {
    const { engine, host } = await mounted()
    engine.setSelection({ kind: 'rect', rect: { x: 0, y: 0, width: 40, height: 40 } })
    engine.fillMaskFromSelection('layer-1')

    engine.setTool('select')
    press(host, 200, 200)
    drag(host, 400, 400)
    release()
    gpu.painted = []
    engine.apply(masked())

    expect(gpu.painted.filter(id => id === 1)).toHaveLength(2)
  })
})

describe('flattening the document', () => {
  // What an edit sends to the API: the model is asked about what the eye sees, not about a
  // stack it knows nothing of.
  it('hands back the payload alone, without the data URL around it', async () => {
    const { engine } = await mounted()

    await expect(engine.snapshot()).resolves.toBe('QUJD')
  })

  it('frames the whole document when no region is named', async () => {
    const { engine } = await mounted()

    await engine.snapshot()

    expect(gpu.extracted).toHaveLength(1)
    expect(gpu.extracted[0]?.frame).toBeDefined()
  })

  /**
   * Not the renderer's resolution, which is the display scale: the same document would be sent
   * at 1024² from one screen and 2048² from another, at twice the price and past the 6 MB the
   * upload route accepts.
   */
  it('sends the document at its own size, whatever the screen is worth', async () => {
    const { engine } = await mounted()

    await engine.snapshot()

    expect(gpu.extracted[0]?.resolution).toBe(1)
  })

  // Extracted bare, the sprite loses the transform `place` put on it and the mask arrives
  // offset from the picture it masks.
  it('frames a mask on the document, like the picture it masks', async () => {
    const { engine } = await mounted({
      ...DEFAULT_CANVAS,
      layers: [{ ...pixelLayer('layer-1', 'Background'), mask: { enabled: true, linked: true } }],
      activeLayerId: 'layer-1',
    })

    await engine.maskSnapshot('layer-1')

    expect(gpu.extracted[0]?.frame).toBeDefined()
    expect(gpu.extracted[0]?.resolution).toBe(1)
  })

  // The mask one paints is the mask one regenerates: the same texture, alone.
  it('extracts the mask of a layer on its own', async () => {
    const { engine } = await mounted({
      ...DEFAULT_CANVAS,
      layers: [{ ...pixelLayer('layer-1', 'Background'), mask: { enabled: true, linked: true } }],
      activeLayerId: 'layer-1',
    })

    await expect(engine.maskSnapshot('layer-1')).resolves.toBe('QUJD')
  })

  it('says nothing for a layer that carries no mask', async () => {
    const { engine } = await mounted()

    await expect(engine.maskSnapshot('layer-1')).resolves.toBeNull()
  })
})

/**
 * What a saved image weighs. The stack goes in the manifest and the pixels in a file per surface,
 * so this is the seam between a document on disk and the textures only the GPU holds.
 */
describe('saving and restoring the pixels', () => {
  const masked = (): CanvasState => ({
    ...DEFAULT_CANVAS,
    layers: [
      { ...pixelLayer('layer-1', 'Background'), mask: { enabled: true, linked: true } },
      pixelLayer('layer-2', 'Paint'),
    ],
    activeLayerId: 'layer-1',
  })

  it('hands back one picture per surface, masks included', async () => {
    const { engine } = await mounted(masked())

    await expect(engine.pixelSnapshots()).resolves.toEqual([
      { layerId: 'layer-1', mask: false, data: 'QUJD' },
      { layerId: 'layer-1', mask: true, data: 'QUJD' },
      { layerId: 'layer-2', mask: false, data: 'QUJD' },
    ])
  })

  /**
   * The texture, not the placed sprite: a surface is document-sized and the transform lives in
   * the state, so extracting the sprite would bake in a move `place` applies again on the way in.
   */
  it('extracts the texture rather than the sprite, at the document’s own scale', async () => {
    const { engine } = await mounted()
    gpu.extracted.length = 0

    await engine.pixelSnapshots()

    expect(gpu.extracted[0]?.resolution).toBe(1)
    expect(gpu.extracted[0]?.frame).toBeUndefined()
  })

  it('hands back nothing for a group, which owns no texture', async () => {
    const { engine } = await mounted({
      ...DEFAULT_CANVAS,
      layers: [groupLayer('group-1', 'Set', [])],
      activeLayerId: null,
    })

    await expect(engine.pixelSnapshots()).resolves.toEqual([])
  })

  it('hands back nothing before a document is applied', async () => {
    const engine = new CanvasEngine(silentOptions())

    await expect(engine.pixelSnapshots()).resolves.toEqual([])
  })

  it('draws a saved picture back into the surface it came from', async () => {
    const { engine } = await mounted(masked())
    gpu.loaded.length = 0

    await engine.restoreSnapshot({ layerId: 'layer-1', mask: true, data: 'QUJD' })

    expect(gpu.loaded[0]?.src).toBe('data:image/png;base64,QUJD')
    expect(gpu.loaded[0]?.parser).toBe('texture')
  })
})

describe('adjustment layers', () => {
  const graded = (values: Partial<AdjustmentStack> = {}): CanvasState =>
    stacked([
      pixelLayer('layer-1', 'Background'),
      {
        ...adjustmentLayer('grade', 'Exposure', 'exposure'),
        values: { ...NEUTRAL_ADJUSTMENTS, ...values },
      },
    ])

  // It holds no pixels of its own: allocating it a document-sized texture would be pure waste.
  it('costs no texture', async () => {
    await mounted(graded())

    expect(gpu.texturesCreated).toBe(1)
  })

  it('grades through a container of its own, carrying one filter', async () => {
    await mounted(graded())
    const pass = groupContainer('grade')

    expect(pass?.filters).toHaveLength(1)
  })

  // What it covers goes inside it: the filter grades the pass, not a sibling beside it.
  it('holds what it grades rather than sitting next to it', async () => {
    await mounted(graded())

    expect(groupContainer('grade')?.children).toHaveLength(1)
  })

  /**
   * The container holds the layers it grades, so hiding it would hide the whole stack under it.
   * The eye of an adjustment drops its pass instead.
   */
  it('drops its pass when it is hidden, rather than hiding what it grades', async () => {
    const layer = { ...adjustmentLayer('grade', 'Exposure', 'exposure'), visible: false }
    await mounted(stacked([pixelLayer('layer-1', 'Background'), layer]))

    const pass = groupContainer('grade')
    expect(pass?.filters).toEqual([])
    expect(pass?.visible).toBe(true)
  })

  it('lets the pass go when the layer leaves the stack', async () => {
    const { engine } = await mounted(graded())

    engine.apply(stacked([pixelLayer('layer-1', 'Background')]))

    expect(groupContainer('grade')?.children).toHaveLength(0)
  })
})

describe('drawing a shape', () => {
  it('draws into the armed layer when the hand comes up, and not before', async () => {
    const { engine, host } = await mounted()
    engine.setTool('shape')
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 300, 260)
    // The undo tiles are photographed on the way, into textures of their own; what must not be
    // written yet is the layer, or every intermediate shape would stay behind.
    expect(gpu.painted).not.toContain(0)

    release()
    expect(gpu.painted).toContain(0)
  })

  it('reports one patch, so one shape undoes in one go', async () => {
    const { engine, host, patches } = await mounted()
    engine.setTool('shape')

    press(host, 200, 200)
    drag(host, 300, 260)
    release()

    expect(patches).toHaveLength(1)
  })

  // Six modes, one tool: the bar says which shape the next drag draws.
  it('draws whichever of the six was armed', async () => {
    const { engine, host } = await mounted()
    engine.setTool('shape')
    engine.setShape('star', 5)
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 300, 260)
    release()

    expect(gpu.painted).toContain(0)
  })

  it('draws nothing on a layer whose pixels are padlocked', async () => {
    const { engine, host, patches } = await mounted(
      stacked([
        {
          ...pixelLayer('layer-1', 'Background'),
          locked: { pixels: true, position: false, alpha: false },
        },
      ]),
    )
    engine.setTool('shape')
    gpu.painted = []

    press(host, 200, 200)
    drag(host, 300, 260)
    release()

    expect(gpu.painted).not.toContain(0)
    expect(patches).toEqual([])
  })
})

describe('captions', () => {
  const caption = (text: string, size = 48): CanvasState =>
    stacked([
      pixelLayer('layer-1', 'Background'),
      { ...textLayer('t', text, { x: 10, y: 20 }), size },
    ])

  it('asks the stack for a caption where the pointer landed', async () => {
    const { engine, host, captions } = await mounted()
    engine.setTool('text')

    press(host, 300, 250)

    expect(captions).toEqual([{ x: 300, y: 250 }])
  })

  /**
   * The face a caption is set in has to be in the page before the browser can draw with it. The
   * same reference a 3D text stores — see `domain/font` — and the studio's own three are files
   * beside the bundle rather than anything the machine has installed.
   */
  it('asks the page for the face a caption is set in', async () => {
    const { engine, faces } = await mounted()

    engine.apply(caption('Hello'))
    await flushMicrotasks()

    expect(faces).toEqual(['Lato'])
  })

  // A document of twenty captions in one font must not fetch it twenty times.
  it('asks for a face once, whatever is set in it', async () => {
    const { engine, faces } = await mounted()

    engine.apply(caption('Hello'))
    await flushMicrotasks()
    engine.apply(caption('Goodbye'))
    await flushMicrotasks()

    expect(faces).toEqual(['Lato'])
  })

  /**
   * The one fetch is shared, so the redraw has to be too. Every caption but the one that happened
   * to ask sat behind the early return, was drawn in the generic, and stayed there until someone
   * edited it — two fonts on screen for a document set in one.
   */
  it('redraws every caption in a family when its face lands, not only the one that asked', async () => {
    // Surfaces are built in document order, and `layer-1` takes texture 0.
    const FIRST_CAPTION = 1
    const SECOND_CAPTION = 2
    let land = (): void => {}
    const onItsWay = new Promise<void>(resolve => {
      land = resolve
    })
    const { engine } = await mounted(DEFAULT_CANVAS, 'brush', () => onItsWay)

    engine.apply(
      stacked([
        pixelLayer('layer-1', 'Background'),
        textLayer('first', 'Hello', { x: 10, y: 20 }),
        textLayer('second', 'Goodbye', { x: 10, y: 60 }),
      ]),
    )
    await flushMicrotasks()
    // Both are on screen in the generic by now; what follows is the file arriving.
    gpu.painted = []

    land()
    await flushMicrotasks()

    expect(gpu.painted).toEqual([FIRST_CAPTION, SECOND_CAPTION])
  })

  /**
   * The redraw is decided by a key built from what the caption says. Left out of it, the face was
   * an edit the screen never showed — the words stayed in the old font for good, and the page was
   * never asked for the new one.
   */
  it('redraws and asks for the face when only the font changed', async () => {
    const { engine, faces } = await mounted()
    engine.apply(caption('Hello'))
    await flushMicrotasks()
    gpu.painted = []

    const mono: FontRef = { source: 'embedded', family: 'IBM Plex Mono' }
    const refaced = stacked([
      pixelLayer('layer-1', 'Background'),
      { ...textLayer('t', 'Hello', { x: 10, y: 20 }), font: mono },
    ])
    engine.apply(refaced)
    await flushMicrotasks()

    expect(gpu.painted).toContain(1)
    expect(faces).toEqual(['Lato', 'IBM Plex Mono'])
  })

  /**
   * A face the page refuses is said once and left alone: retrying on every reconciliation would
   * fetch a file that is not there once per frame, and `familyStack` has already put a generic
   * behind it, so the caption stays readable.
   */
  it('says a face it could not put in the page, once, and draws in the generic', async () => {
    const logs = bridgeWatchingLogs()
    const { engine } = await mountedWithoutFace()

    engine.apply(caption('Hello'))
    await flushMicrotasks()
    engine.apply(caption('Goodbye'))
    await flushMicrotasks()

    expect(logs.entries().filter(entry => entry.scope === 'font.face')).toHaveLength(1)
  })

  // The caption may have been retyped in another face while the file was on its way: what the
  // state holds now is what decides, never what asked.
  it('leaves a caption alone when it was refaced while its file was on its way', async () => {
    const { engine, faces } = await mounted()

    engine.apply(caption('Hello'))
    engine.apply(stacked([pixelLayer('layer-1', 'Background')]))
    await flushMicrotasks()

    expect(faces).toEqual(['Lato'])
  })

  // Nothing to fetch: the browser already resolves an installed family by name.
  it('asks the page for nothing when the face is one the machine has', async () => {
    const { engine, faces } = await mounted()
    const font: FontRef = { source: 'system', family: 'Futura' }
    const installed = stacked([{ ...textLayer('t', 'Hello', { x: 10, y: 20 }), font }])

    engine.apply(installed)
    await flushMicrotasks()

    expect(faces).toEqual([])
  })

  it('rasterizes the words into the layer that holds them', async () => {
    const { engine } = await mounted()
    gpu.painted = []

    engine.apply(caption('Hello'))

    expect(gpu.painted).toContain(1)
  })

  // Rasterizing is a canvas redraw and a GPU upload: unchanged words must not pay for it.
  it('redraws only when the words or their setting change', async () => {
    const { engine } = await mounted(caption('Hello'))
    gpu.painted = []

    engine.apply(caption('Hello'))
    expect(gpu.painted).toEqual([])

    engine.apply(caption('Goodbye'))
    expect(gpu.painted).toContain(1)
  })

  /** A caption is redrawn whole whenever a letter changes: a stroke on it would be wiped. */
  it('takes no brush stroke, which the next letter typed would erase', async () => {
    const { host, patches } = await mounted(stacked([textLayer('t', 'Hello', { x: 10, y: 20 })]))

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(patches).toEqual([])
  })

  /**
   * Its mask, though, is never redrawn — so it takes a stroke like any other. Refusing it was a
   * refusal too wide: the only surface `drawText` overwrites is the layer's own.
   */
  it('takes one into its mask, which nothing ever redraws', async () => {
    const masked = stacked([
      { ...textLayer('t', 'Hello', { x: 10, y: 20 }), mask: { enabled: true, linked: true } },
    ])
    const { engine, host, patches } = await mounted(masked)
    engine.setPaintTarget('mask')

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(patches).toHaveLength(1)
  })

  // Its texture went with it, so the words have to be drawn again on the way back.
  it('draws the words again when the layer comes back', async () => {
    const { engine } = await mounted(caption('Hello'))
    engine.apply(stacked([pixelLayer('layer-1', 'Background')]))
    gpu.painted = []

    engine.apply(caption('Hello'))

    expect(gpu.painted.length).toBeGreaterThan(0)
  })
})

describe('the layer transform', () => {
  /** One layer, with the transform under test, and the sprite the engine built for it. */
  async function placed(transform: Partial<Transform>): Promise<Placed> {
    const layer = {
      ...pixelLayer('layer-1', 'Background'),
      transform: { ...IDENTITY, ...transform },
    }
    // A test may place twice, and each mount builds its own sprites.
    gpu.sprites = []
    await mounted({ ...DEFAULT_CANVAS, layers: [layer], activeLayerId: layer.id })

    const sprite = gpu.sprites[0]
    if (!sprite) throw new Error('the engine built no sprite for the layer')
    return sprite
  }

  it('turns, scales and skews the sprite the way the state says', async () => {
    const sprite = await placed({ rotation: Math.PI / 2, scaleX: 2, scaleY: 3, skewX: 0.1 })

    expect(sprite.rotation).toBe(Math.PI / 2)
    expect(sprite.scale).toMatchObject({ x: 2, y: 3 })
    expect(sprite.skew).toMatchObject({ x: 0.1, y: 0 })
  })

  // The origin is a fraction of the box, so a resize does not move the pivot.
  it('pivots on the fraction of the box the origin names', async () => {
    const sprite = await placed({ originX: 0.5, originY: 0.25 })

    expect(sprite.pivot).toMatchObject({ x: 512, y: 256 })
  })

  /**
   * A pivot displaces the sprite by itself. Without the compensation, moving the origin of an
   * otherwise untouched layer would slide it across the document — which the type forbids.
   */
  it('leaves an untransformed layer where the state put it, whatever its origin', async () => {
    const centred = await placed({ x: 10, y: 20, originX: 0.5, originY: 0.5 })
    expect(centred.position.x - centred.pivot.x).toBe(10)
    expect(centred.position.y - centred.pivot.y).toBe(20)

    const cornered = await placed({ x: 10, y: 20, originX: 0, originY: 0 })
    expect(cornered.position).toMatchObject({ x: 10, y: 20 })
  })
})

describe('the ruler bands', () => {
  it('lays a guide down from the top band', async () => {
    const { host, guides } = await mounted()
    press(host, 120, RULER_SIZE - 5)

    expect(guides.calls).toEqual(['begin', 'add:y:15'])
  })

  it('lays a vertical one from the left band', async () => {
    const { host, guides } = await mounted()
    press(host, RULER_SIZE - 5, 120)

    expect(guides.calls[1]).toMatch(/^add:x:/)
  })

  // The corner square is inert chrome. Falling through to the tool meant a brush dab there, and
  // a whole layer flooded with the bucket.
  it('starts nothing at all in the corner where the two bands meet', async () => {
    const { host, guides } = await mounted()
    const renders = gpu.renders
    press(host, 4, 4)

    expect(guides.calls).toEqual([])
    // The bucket used to flood the whole layer from here, and the brush used to leave a dab.
    expect(gpu.renders).toBe(renders)
  })

  it('throws a guide away when it is dropped back on the chrome', async () => {
    const { host, guides } = await mounted()
    press(host, 120, 5)
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 8, clientY: 8 }))

    expect(guides.calls).toEqual(['begin', 'add:y:5', 'remove:guide-1', 'end'])
  })

  it('sticks a new guide to the frame edge it was dropped near', async () => {
    const { engine, host, guides } = await mounted()
    engine.setView(VIEW_1_1)
    press(host, 120, 5)

    expect(guides.calls).toEqual(['begin', 'add:y:0'])
  })

  it('keeps it when it is dropped on the canvas', async () => {
    const { host, guides } = await mounted()
    press(host, 120, 5)
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 200 }))

    expect(guides.calls).toEqual(['begin', 'add:y:5', 'end'])
  })

  // A middle-button pan can land mid-drag: a guide gesture left open would make the next drag of
  // that guide re-create it rather than move it.
  it('closes an open guide drag when a pan takes the pointer', async () => {
    const { host, guides } = await mounted()
    press(host, 120, 5)
    press(host, 200, 200, 1)

    expect(guides.calls).toEqual(['begin', 'add:y:5', 'end'])
  })
})

describe('the view', () => {
  it('publishes a pan once a frame rather than once per pointer move', async () => {
    const { host, viewports } = await mounted()
    press(host, 200, 200, 1)
    for (const x of [210, 220, 230]) {
      host.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: 200 }))
    }

    expect(viewports).toEqual([])
    await nextFrame()
    expect(viewports).toHaveLength(1)
  })

  /**
   * `setView` ignores the viewport it published itself, which comes back one React commit late.
   * It must not ignore a command that lands in the same window — ⌘0 during a trackpad glide.
   */
  it('takes a command that arrives while a pan is still being published', async () => {
    const { engine, host } = await mounted()
    press(host, 200, 200, 1)
    host.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 200 }))

    const commanded: Viewport = { x: 12, y: 34, scale: 3 }
    engine.setView({ ...DEFAULT_VIEW, viewport: commanded })
    // A second push of the same viewport, as React re-renders: still the command, not the pan.
    engine.setView({ ...DEFAULT_VIEW, viewport: commanded })

    host.dispatchEvent(new PointerEvent('pointermove', { clientX: 261, clientY: 200 }))
    expect(gpu.renders).toBeGreaterThan(0)
  })
})

/** An engine that reports to nobody, for the paths that answer before anything is mounted. */
function silentOptions(): ConstructorParameters<typeof CanvasEngine>[0] {
  const nothing = (): void => undefined
  return {
    addFace: () => Promise.resolve(),
    onPick: nothing,
    onPixels: nothing,
    onPixelsDropped: nothing,
    onViewport: nothing,
    onSelection: nothing,
    onHost: nothing,
    onText: nothing,
    onCrop: nothing,
    guides: { add: () => '', move: nothing, remove: nothing, beginDrag: nothing, endDrag: nothing },
    layers: { translate: nothing, transform: nothing, beginDrag: nothing, endDrag: nothing },
  }
}

/** `pointermove` goes to the host, `pointerup` to the window — as the engine listens for them. */
function drag(host: HTMLElement, x: number, y: number, shiftKey = false): void {
  host.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, shiftKey }))
}

function release(x = 400, y = 400): void {
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }))
}

describe('the crop tool', () => {
  /** A frame is placed by the drag and applied by ⏎: the release is not what commits it. */
  it('places a frame on release without cropping anything yet', async () => {
    const { host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    expect(crops).toEqual([])
  })

  /**
   * The frame draws its grips through the same geometry the move tool's box does, so it answers
   * the same hover. Without this the crop kept the blind aiming the branch set out to remove.
   */
  it('says a grip of the placed frame pulls across its edge', async () => {
    const { host } = await mounted(DEFAULT_CANVAS, 'crop')
    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    drag(host, 400, 200)

    expect(host.querySelector('canvas')?.style.cursor).toBe('ew-resize')
  })

  // A crop does not turn the document, so there is no ring outside its corners to find. Twelve
  // pixels out is past the grip and well inside the reach a layer's corner would have answered.
  it('offers no rotation outside a corner of the frame', async () => {
    const { host } = await mounted(DEFAULT_CANVAS, 'crop')
    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    drag(host, 412, 312)

    expect(host.querySelector('canvas')?.style.cursor).toBe('')
  })

  it('crops to the placed frame on ⏎', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)
    engine.applyCrop()

    expect(crops).toEqual([{ x: 100, y: 100, width: 300, height: 200 }])
  })

  it('takes the frame off screen on ⎋, and crops nothing', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)
    engine.dropCrop()
    engine.applyCrop()

    expect(crops).toEqual([])
  })

  it('ignores ⏎ when no frame is placed', async () => {
    const { engine, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    engine.applyCrop()

    expect(crops).toEqual([])
  })

  /** The grips are real: this is the whole reason the frame outlives its drag. */
  it('adjusts the placed frame when a grip is dragged', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    // The east grip sits at x = 400, halfway down the frame.
    press(host, 400, 200)
    drag(host, 500, 200)
    release(500, 200)
    engine.applyCrop()

    expect(crops).toEqual([{ x: 100, y: 100, width: 400, height: 200 }])
  })

  it('starts a fresh frame when the press lands away from every grip', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    press(host, 600, 600)
    drag(host, 700, 660)
    release(700, 660)
    engine.applyCrop()

    expect(crops).toEqual([{ x: 600, y: 600, width: 100, height: 60 }])
  })

  it('places nothing for a press the hand never dragged', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 200, 200)
    release(200, 200)
    engine.applyCrop()

    expect(crops).toEqual([])
  })

  it('clamps a drag that runs off the document, so a crop never grows the frame', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 900, 900)
    drag(host, 2000, 2000)
    release(2000, 2000)
    engine.applyCrop()

    expect(crops).toEqual([{ x: 900, y: 900, width: 124, height: 124 }])
  })

  it('squares the frame while shift is held', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 200, true)
    release(400, 200)
    engine.applyCrop()

    expect(crops).toEqual([{ x: 100, y: 100, width: 300, height: 300 }])
  })

  /**
   * The frame is not a gesture: panning to see what a crop would keep is the point, and a middle
   * click used to be a way to commit one by accident.
   */
  it('keeps the frame through a middle-button pan', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    press(host, 400, 300, 1)
    release(400, 300)
    engine.applyCrop()

    expect(crops).toEqual([{ x: 100, y: 100, width: 300, height: 200 }])
  })

  /**
   * The engine hears the keyboard on `window`, so a second image left with a frame up would crop
   * itself from behind. Arming another tool is what takes the frame down.
   */
  it('drops the frame when another tool is armed', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)
    engine.setTool('brush')
    engine.applyCrop()

    expect(crops).toEqual([])
  })

  it('leaves a key typed into a prompt alone', async () => {
    const { host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    const field = document.createElement('input')
    document.body.appendChild(field)
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }))
    field.remove()

    expect(crops).toEqual([])
  })

  /**
   * The one that decides whether a crop keeps the picture. A surface is document-sized, so the
   * new one only fits the kept region — carrying the old texture in at the origin would copy the
   * document's top-left corner instead, and the frame would come out blank wherever `rect.x`
   * pushed past the new width.
   */
  it('carries the kept region into the new surface, not the document’s corner', async () => {
    const { engine, host } = await mounted(DEFAULT_CANVAS, 'crop')
    gpu.sprites.length = 0

    press(host, 900, 900)
    drag(host, 2000, 2000)
    release(2000, 2000)
    engine.applyCrop()

    expect(gpu.sprites[0]?.position).toEqual({ x: -900, y: -900 })
  })

  /**
   * A frame is placed against the document it was drawn on. A quarter turn or a resample under it
   * would leave it pointing outside the picture, and applying it would recut every surface to
   * nothing — with the undo tiles thrown away in the same move.
   */
  it('drops the frame when the document changes size under it', async () => {
    const { engine, host, crops } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 800, 100)
    drag(host, 1000, 400)
    release(1000, 400)
    engine.apply({ ...DEFAULT_CANVAS, width: 512, height: 2048 })
    engine.applyCrop()

    expect(crops).toEqual([])
  })

  it('gives the new surface the frame’s own size', async () => {
    const { engine, host } = await mounted(DEFAULT_CANVAS, 'crop')
    const before = gpu.texturesCreated

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)
    engine.applyCrop()

    expect(gpu.texturesCreated).toBeGreaterThan(before)
    expect(gpu.painted.length).toBeGreaterThan(0)
  })

  // The tool draws a frame and nothing else: it must never reach the brush path below it.
  it('leaves the pixels alone', async () => {
    const { host, patches } = await mounted(DEFAULT_CANVAS, 'crop')

    press(host, 100, 100)
    drag(host, 400, 300)
    release(400, 300)

    expect(patches).toEqual([])
  })
})

describe('the move tool', () => {
  // The layer position lives in the state, not on the sprite: anything else is lost to the next
  // `apply` and invisible to the history.
  it('writes the layer position into the state instead of nudging the sprite', async () => {
    const { engine, host, layers } = await mounted()
    engine.setTool('move')

    press(host, 200, 200)
    drag(host, 260, 230)
    release()

    expect(layers).toEqual(['begin', 'translate:layer-1:60:30', 'end'])
  })

  // Every step is absolute from where the layer stood, or merging the drag into one entry would
  // rewind a single pointer move.
  it('reports where the layer is, not how far the pointer went', async () => {
    const { engine, host, layers } = await mounted()
    engine.setTool('move')

    press(host, 200, 200)
    drag(host, 260, 200)
    drag(host, 300, 200)

    expect(layers).toEqual(['begin', 'translate:layer-1:60:0', 'translate:layer-1:100:0'])
  })

  it('sticks the layer edge to a guide the way a guide sticks to the frame', async () => {
    const { engine, host, layers } = await mounted({
      ...DEFAULT_CANVAS,
      guides: [{ id: 'g', axis: 'x', position: 64 }],
    })
    engine.setView(VIEW_1_1)
    engine.setTool('move')

    press(host, 200, 200)
    drag(host, 262, 200)

    expect(layers.at(-1)).toBe('translate:layer-1:64:0')
  })

  it('refuses to move a layer whose position is padlocked', async () => {
    const { engine, host, layers } = await mounted({
      ...DEFAULT_CANVAS,
      layers: [pixelLayer('layer-1', 'Background')].map(layer => ({
        ...layer,
        locked: { pixels: false, position: true, alpha: false },
      })),
    })
    engine.setTool('move')

    press(host, 200, 200)
    drag(host, 260, 230)

    expect(layers).toEqual([])
  })

  it('closes the drag when a pan takes the pointer mid-gesture', async () => {
    const { engine, host, layers } = await mounted()
    engine.setTool('move')

    press(host, 200, 200)
    press(host, 220, 220, 1)

    expect(layers.at(-1)).toBe('end')
  })
})

/**
 * What the pointer says before the button goes down. The grips were reachable only by guessing:
 * nothing changed under an idle hand, so the twelve pixels of a grip had to be found blind.
 *
 * Pixi owns this canvas and the cursor goes on it, which is what lets it win for as long as the
 * gesture lasts and hand it back to the host on release.
 */
const cursorOn = (host: HTMLElement): string => {
  // Found by what it is, not by where it sits: the overlay marks itself unclickable, so the
  // other canvas is Pixi's. Taking the first would ride on the order `mount` happens to append
  // them in, and every assertion of an *absent* cursor would pass on the wrong element.
  const canvases = [...host.querySelectorAll('canvas')]
  const pixi = canvases.filter(canvas => canvas.style.pointerEvents !== 'none')
  const only = pixi.length === 1 ? pixi[0] : undefined
  return only ? only.style.cursor : `expected one paintable canvas, found ${pixi.length}`
}

describe('the transform grips', () => {
  /** A layer occupying the whole 1024² document, so the grips sit on the document's corners. */
  const armed = async () => {
    const harness = await mounted()
    harness.engine.setTool('move')
    return harness
  }

  // Pixi ships no transformer, so the grips are ours — and a drag on one is not a drag of the
  // layer, which is why they are tested before the move gesture.
  it('takes a corner grip rather than moving the layer', async () => {
    const { host, layers } = await armed()

    press(host, 1024, 1024)
    drag(host, 1224, 1224)

    expect(layers.at(-1)).toMatch(/^transform:layer-1:/)
  })

  it('scales from the far corner, so the opposite one stays put', async () => {
    const { host, layers } = await armed()

    press(host, 1024, 1024)
    drag(host, 2048, 2048)

    expect(layers.at(-1)).toBe('transform:layer-1:2.00:2.00:0.00')
  })

  // Every step is absolute from where the layer stood, or merging the drag into one entry would
  // rewind a single pointer move.
  it('reports where the layer is, not how far the pointer went', async () => {
    const { host, layers } = await armed()

    press(host, 1024, 1024)
    drag(host, 2048, 2048)
    drag(host, 1536, 1536)

    expect(layers.at(-1)).toBe('transform:layer-1:1.50:1.50:0.00')
  })

  /**
   * There is no rotation grip: the zone just outside a corner turns the layer, as it does in
   * Figma. The layer is pushed clear of the origin on purpose — outside its top-left corner has
   * to be canvas, and at the origin that would be the ruler band.
   */
  const offset = (): Promise<Awaited<ReturnType<typeof mounted>>> =>
    mounted(
      stacked([
        { ...pixelLayer('layer-1', 'Background'), transform: { ...IDENTITY, x: 200, y: 200 } },
      ]),
    )

  it('turns the layer by the zone just outside a corner', async () => {
    const { engine, host, layers } = await offset()
    engine.setTool('move')

    // Beyond the north-west corner (200, 200) — too far out for the grip, inside the rotation
    // ring — then a quarter turn about the middle at (712, 712).
    press(host, 190, 190)
    drag(host, 1234, 190)

    expect(layers.at(-1)).toMatch(/^transform:layer-1:1\.00:1\.00:1\.5/)
  })

  // Inside the corner is a drag of the layer, not a turn: only the outside of it rotates.
  it('moves the layer for a drag that started just inside the same corner', async () => {
    const { engine, host, layers } = await offset()
    engine.setTool('move')

    press(host, 210, 210)
    drag(host, 240, 240)

    expect(layers.at(-1)).toBe('translate:layer-1:230:230')
  })

  it('says a grip pulls across the edge when the pointer rests on one', async () => {
    const { host } = await armed()

    drag(host, 1024, 512)

    expect(cursorOn(host)).toBe('ew-resize')
  })

  it('says a corner pulls along its diagonal', async () => {
    const { host } = await armed()

    drag(host, 1024, 1024)

    expect(cursorOn(host)).toBe('nwse-resize')
  })

  // Drawn rather than named: no platform ships a rotation cursor.
  it('draws a turning cursor over the zone outside a corner', async () => {
    const { host } = await armed()

    drag(host, 1034, 1034)

    expect(cursorOn(host)).toContain('data:image/svg+xml')
  })

  /**
   * Leaving a grip has to take its cursor with it. Established before it is denied — an assertion
   * that the cursor is empty, on a canvas where nothing ever wrote one, cannot fail.
   */
  it('gives the cursor back when the pointer leaves a grip for the middle', async () => {
    const { host } = await armed()
    drag(host, 1024, 512)
    expect(cursorOn(host)).toBe('ew-resize')

    drag(host, 512, 512)

    expect(cursorOn(host)).toBe('')
  })

  /**
   * The layer's rotation is what turns the arrow, and the engine has to hand it over: a quarter
   * turn puts the east grip due south, where it pulls up and down.
   *
   * Without this nothing would notice `hoverBox` passing a fixed zero — every other cursor test
   * arms a layer that was never turned.
   */
  it('turns the arrow with the layer, not just with the grip', async () => {
    const { engine, host } = await mounted(
      stacked([
        {
          ...pixelLayer('layer-1', 'Background'),
          transform: { ...IDENTITY, rotation: Math.PI / 2 },
        },
      ]),
    )
    engine.setTool('move')

    drag(host, 512, 1024)

    expect(cursorOn(host)).toBe('ns-resize')
  })

  /**
   * Space is a pan in waiting and owns the cursor while it is held. What the pointer was over is
   * dropped on release: the hover only recomputes when it *changes*, so a grip the hand never
   * left would compare equal for ever and its arrow would never come back.
   */
  it('brings the grip’s arrow back after space was held and released', async () => {
    const { host } = await armed()
    drag(host, 1024, 512)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }))

    drag(host, 1024, 512)

    expect(cursorOn(host)).toBe('ew-resize')
  })

  // Arming another layer keeps `layers` identical, so it is the one way a box moves under a
  // still pointer without the tree changing — and the cursor used to keep the old promise.
  it('drops the cursor when another layer is armed under a still pointer', async () => {
    const state = stacked([pixelLayer('layer-1', 'Background'), pixelLayer('layer-2', 'Top')])
    const { engine, host } = await mounted(state)
    engine.setTool('move')
    drag(host, 1024, 512)
    expect(cursorOn(host)).toBe('ew-resize')

    // The very shape `selectLayer` produces: a fresh state around the same `layers` array.
    engine.apply({ ...state, activeLayerId: 'layer-2' })

    expect(cursorOn(host)).toBe('')
  })

  // A turn is one gesture, so it is one history entry — the drag has to be closed like any other.
  it('closes the history entry a turn opened', async () => {
    const { engine, host, layers } = await offset()
    engine.setTool('move')

    press(host, 190, 190)
    drag(host, 1234, 190)
    release()

    expect(layers.at(-1)).toBe('end')
  })

  /**
   * The chrome belongs to the tool that draws it. Arming the brush used to leave the move tool's
   * cursor and grips on screen until something else happened to repaint.
   */
  it('hands the cursor back when another tool is armed', async () => {
    const { engine, host } = await armed()
    drag(host, 1024, 512)

    engine.setTool('brush')

    expect(cursorOn(host)).toBe('')
  })

  // Presence established first, then denied: the same hover that answers under the move tool has
  // to answer nothing under the brush, and an empty canvas would say that on its own.
  it('offers no grip at all once another tool is armed', async () => {
    const { engine, host } = await armed()
    drag(host, 1024, 512)
    expect(cursorOn(host)).toBe('ew-resize')

    engine.setTool('brush')
    drag(host, 1024, 513)

    expect(cursorOn(host)).toBe('')
  })

  it('moves the layer for a drag that took no grip at all', async () => {
    const { host, layers } = await armed()

    press(host, 400, 400)
    drag(host, 460, 430)

    expect(layers.at(-1)).toBe('translate:layer-1:60:30')
  })

  it('takes no grip on a layer whose position is padlocked', async () => {
    const { engine, host, layers } = await mounted(
      stacked([
        {
          ...pixelLayer('layer-1', 'Background'),
          locked: { pixels: false, position: true, alpha: false },
        },
      ]),
    )
    engine.setTool('move')

    press(host, 1024, 1024)
    drag(host, 1224, 1224)

    expect(layers).toEqual([])
  })
})

/**
 * A tool that cannot act says so under the hand, before the click. The refusal was silent: the
 * brush, the bucket, the shapes and the move tool all returned without a word on a group, on an
 * adjustment layer, on a padlocked one — and a picture that takes no paint looks exactly like
 * one whose stroke went somewhere unexpected.
 *
 * At the cursor rather than in a toast: a refusal has to be readable BEFORE the gesture, which
 * no toast allows, and one toast per refused gesture would be worse than the silence it fixes.
 */
describe('a tool that can do nothing here', () => {
  const BARE = { ...VIEW_1_1, rulers: false, guides: false, snap: false }

  async function hoveringWith(tool: CanvasTool, state: CanvasState): Promise<string> {
    const harness = await mounted(state, tool)
    harness.engine.setView(BARE)
    await nextFrame()

    drag(harness.host, 120, 90)
    await nextFrame()
    return cursorOn(harness.host)
  }

  /** A group swallows every stroke: it holds layers, never pixels of its own. */
  const armedGroup = (): CanvasState => {
    const group = groupLayer('g', 'G', [pixelLayer('a', 'A')])
    return { ...DEFAULT_CANVAS, layers: [group], activeLayerId: group.id }
  }

  const padlocked = (): CanvasState =>
    stacked([layerFixture({ locked: { ...UNLOCKED, pixels: true } })])

  const pinned = (): CanvasState =>
    stacked([layerFixture({ locked: { ...UNLOCKED, position: true } })])

  it('refuses the brush on a group, and says so under the hand', async () => {
    expect(await hoveringWith('brush', armedGroup())).toBe('not-allowed')
  })

  it('refuses the brush on a layer padlocked against paint', async () => {
    expect(await hoveringWith('brush', padlocked())).toBe('not-allowed')
  })

  it('refuses the eraser, the bucket and the shapes on the same layer', async () => {
    expect(await hoveringWith('eraser', padlocked())).toBe('not-allowed')
    expect(await hoveringWith('fill', padlocked())).toBe('not-allowed')
    expect(await hoveringWith('shape', padlocked())).toBe('not-allowed')
  })

  // Its own padlock: a layer free to take paint can still be pinned where it stands.
  it('refuses the move tool on a layer pinned in place', async () => {
    expect(await hoveringWith('move', pinned())).toBe('not-allowed')
  })

  it('lets the brush through on a layer that can take it', async () => {
    expect(await hoveringWith('brush', stacked([layerFixture()]))).toBe('')
  })

  /**
   * The eyedropper reads the document, it does not write to it, and the selection tools carve
   * out a region rather than a layer. Neither has anything to refuse on a padlocked layer.
   */
  it('says nothing for the tools a padlock does not stop', async () => {
    expect(await hoveringWith('picker', padlocked())).toBe('')
    expect(await hoveringWith('select', padlocked())).toBe('')
    expect(await hoveringWith('crop', padlocked())).toBe('')
  })

  it('takes the refusal back when a tool that can act is armed', async () => {
    const harness = await mounted(padlocked(), 'brush')
    harness.engine.setView(BARE)
    drag(harness.host, 120, 90)
    await nextFrame()
    expect(cursorOn(harness.host)).toBe('not-allowed')

    harness.engine.setTool('picker')
    drag(harness.host, 122, 92)
    await nextFrame()

    expect(cursorOn(harness.host)).toBe('')
  })

  // Space is a pan in waiting and owns the cursor while it is held — panning is the one gesture
  // no tool may take over, and it works over a padlocked layer like any other.
  it('yields to space, which can always pan', async () => {
    const harness = await mounted(padlocked(), 'brush')
    harness.engine.setView(BARE)
    drag(harness.host, 120, 90)
    await nextFrame()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))
    drag(harness.host, 122, 92)
    await nextFrame()

    expect(cursorOn(harness.host)).toBe('grab')
  })

  it('drops the ring too, since nothing would land under it', async () => {
    const { rings } = overlayRecorder()
    const harness = await mounted(padlocked(), 'brush')
    harness.engine.setView(BARE)
    await nextFrame()

    rings.length = 0
    drag(harness.host, 120, 90)
    await nextFrame()

    expect(rings).toHaveLength(0)
  })
})

describe('the pixel history', () => {
  it('reports one patch for one stroke, not one per dab', async () => {
    const { host, patches } = await mounted()

    press(host, 200, 200)
    drag(host, 240, 240)
    drag(host, 280, 280)
    release()

    expect(patches).toHaveLength(1)
  })

  it('reports one for a bucket fill, which is a gesture with no drag', async () => {
    const { engine, host, patches } = await mounted()
    engine.setTool('fill')

    press(host, 200, 200)

    expect(patches).toHaveLength(1)
  })

  it('gives each stroke its own patch', async () => {
    const { host, patches } = await mounted()

    press(host, 200, 200)
    drag(host, 240, 240)
    release()
    press(host, 300, 300)
    drag(host, 340, 340)
    release()

    expect(new Set(patches).size).toBe(2)
  })

  // The layer holds the "after" pixels already; the undo is the first replay there is to do.
  it('paints the tiles back into the layer the patch was recorded on', async () => {
    const { engine, host, patches } = await mounted()
    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    const patchId = patches[0]
    expect(patchId).toBeDefined()
    expect(engine.restorePixels(patchId ?? '', 'before')).toBe(true)
  })

  it('says so rather than pretending when asked for a patch it never recorded', async () => {
    const { engine } = await mounted()

    expect(engine.restorePixels('never-recorded', 'before')).toBe(false)
  })

  it('leaves a layer whose pixels are padlocked untouched', async () => {
    const { host, patches } = await mounted({
      ...DEFAULT_CANVAS,
      layers: [pixelLayer('layer-1', 'Background')].map(layer => ({
        ...layer,
        locked: { pixels: true, position: false, alpha: false },
      })),
    })
    const renders = gpu.renders

    press(host, 200, 200)
    drag(host, 240, 240)
    release()

    expect(patches).toEqual([])
    expect(gpu.renders).toBe(renders)
  })
})

/**
 * A layer whose asset is gone lists in the panel and draws nothing. The reconciliation must not
 * fall over for it — one unreadable file must not take the rest of the document down — so the
 * log is the only trace of it there will ever be.
 */
describe('a layer whose picture never arrives', () => {
  it('records the asset that failed, and reconciles the rest of the document', async () => {
    const watched = bridgeWatchingLogs()
    gpu.refuseLoad = true

    const { engine } = await mounted(
      stacked([{ ...pixelLayer('a', 'A'), source: 'asset-gone' }, pixelLayer('b', 'B')]),
    )

    await vi.waitFor(() =>
      expect(watched.report).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'canvas.layer',
          message: expect.stringContaining('asset-gone'),
        }),
      ),
    )
    expect(engine).toBeDefined()
    gpu.refuseLoad = false
  })
})

/** The cursor the engine set. It writes on Pixi's canvas, which `mount` puts inside the host. */
function cursorOf(host: HTMLElement): string {
  return host.querySelector('canvas')?.style.cursor ?? ''
}

function wheel(host: HTMLElement, init: WheelEventInit): void {
  host.dispatchEvent(new WheelEvent('wheel', { cancelable: true, ...init }))
}

function key(type: 'keydown' | 'keyup', init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent(type, init))
}

describe('the eyedropper', () => {
  it('hands the colour standing under the pointer to the document', async () => {
    gpu.pixels = [0x33, 0x66, 0x99, 255]
    const { host, picks } = await mounted(DEFAULT_CANVAS, 'picker')

    press(host, 40, 50)

    expect(picks).toEqual([0x336699])
  })

  // A buffer shorter than three channels reads as black rather than as a colour made up from
  // whatever the missing ones defaulted to — an opaque white, say, which `?? 255` would give.
  it('reads a channel it was not given as none of it', async () => {
    gpu.pixels = []
    const { host, picks } = await mounted(DEFAULT_CANVAS, 'picker')

    press(host, 40, 50)

    expect(picks).toEqual([0])
  })

  // One pixel, not the layer: extracting a 1024² sprite to read a single colour is a 4 MB
  // allocation and a synchronous read, on every click.
  it('reads a single pixel, where it was pressed', async () => {
    const { host } = await mounted(DEFAULT_CANVAS, 'picker')

    press(host, 40, 50)

    expect(gpu.sampled).toEqual([{ x: 40, y: 50, width: 1, height: 1 }])
  })

  /**
   * At 1:1 unpanned a screen point and a document point are the same number, so every other test
   * here would pass on an eyedropper that never converted at all. Zoomed, they part company: 41
   * screen pixels are 20.5 document ones, and the pixel holding them is 20.
   */
  it('reads the pixel under the pointer, whatever the zoom', async () => {
    const { engine, host } = await mounted(DEFAULT_CANVAS, 'picker')
    engine.setView({ ...VIEW_1_1, snap: false, viewport: { x: 0, y: 0, scale: 2 } })

    press(host, 41, 51)

    expect(gpu.sampled).toEqual([{ x: 20, y: 25, width: 1, height: 1 }])
  })

  /**
   * Rulers off: their bands cover the first 20 px of each axis and take a press before any tool
   * sees it, so a point at or outside the origin is unreachable with them on.
   */
  it.each([
    { where: 'left of', x: -5, y: 50 },
    { where: 'above', x: 40, y: -5 },
    { where: 'right of', x: 1024, y: 50 },
    { where: 'below', x: 40, y: 1024 },
  ])('says nothing about a point $where the document', async ({ x, y }) => {
    const { engine, host, picks } = await mounted(DEFAULT_CANVAS, 'picker')
    engine.setView({ ...VIEW_1_1, snap: false, rulers: false })

    press(host, x, y)

    expect(picks).toEqual([])
    expect(gpu.sampled).toEqual([])
  })

  // The other side of the same guard: pressed from the outside alone, tightening it to `x < 1` or
  // `x >= width - 1` would take the first and last row of the document away without a test noticing.
  it.each([
    { corner: 'first', x: 0, y: 0 },
    { corner: 'last', x: 1023, y: 1023 },
  ])('reads the $corner pixel of the document', async ({ x, y }) => {
    const { engine, host } = await mounted(DEFAULT_CANVAS, 'picker')
    engine.setView({ ...VIEW_1_1, snap: false, rulers: false })

    press(host, x, y)

    expect(gpu.sampled).toEqual([{ x, y, width: 1, height: 1 }])
  })

  it('says nothing when no layer is armed', async () => {
    const { host, picks } = await mounted({ ...DEFAULT_CANVAS, activeLayerId: null }, 'picker')

    press(host, 40, 50)

    expect(picks).toEqual([])
    expect(gpu.sampled).toEqual([])
  })
})

describe('holding space to pan', () => {
  it('arms the hand, and gives the cursor back on the way up', async () => {
    const { host } = await mounted()

    key('keydown', { code: 'Space' })
    expect(cursorOf(host)).toBe('grab')

    key('keyup', { code: 'Space' })
    expect(cursorOf(host)).toBe('')
  })

  // A space typed into a prompt is a space, not a pan.
  it('leaves a space typed into a field alone', async () => {
    const { host } = await mounted()
    const field = document.createElement('input')
    document.body.appendChild(field)
    // Booked rather than removed after the assertion: a failing expect would leave the field in
    // the page for every test after it, which is the kind of residue shuffling makes unreadable.
    onTestFinished(() => field.remove())

    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))

    expect(cursorOf(host)).toBe('')
  })

  it('ignores a key that is not the space bar', async () => {
    const { host } = await mounted()

    key('keydown', { code: 'KeyB' })

    expect(cursorOf(host)).toBe('')
  })

  // Held down, the key repeats. Re-arming on each repeat would take the grabbing cursor off a
  // pan that is still open and put the idle hand back over it.
  it('ignores the repeats of a key already held', async () => {
    const { host } = await mounted()
    key('keydown', { code: 'Space' })
    press(host, 40, 50)

    key('keydown', { code: 'Space', repeat: true })

    expect(cursorOf(host)).toBe('grabbing')
  })

  it('holds the hand through another key coming up', async () => {
    const { host } = await mounted()
    key('keydown', { code: 'Space' })

    key('keyup', { code: 'KeyB' })

    expect(cursorOf(host)).toBe('grab')
  })

  // ⌘Tab while space is held: the key up never arrives, and the hand would stay for good.
  it('gives the cursor back when the window loses focus', async () => {
    const { host } = await mounted()
    key('keydown', { code: 'Space' })

    window.dispatchEvent(new Event('blur'))

    expect(cursorOf(host)).toBe('')
  })

  // The key going up mid-drag ends the hold, not the gesture: the pan runs to the pointer up.
  it('leaves the grabbing cursor alone while a pan is still open', async () => {
    const { host } = await mounted()
    key('keydown', { code: 'Space' })
    press(host, 40, 50)

    key('keyup', { code: 'Space' })

    expect(cursorOf(host)).toBe('grabbing')
  })
})

describe('the wheel', () => {
  // A trackpad sends a pinch as a wheel with `ctrlKey`, which is also how ⌘/Ctrl + wheel arrives.
  it.each([
    { how: 'ctrl', ctrlKey: true, metaKey: false },
    { how: 'meta', ctrlKey: false, metaKey: true },
  ])('zooms with $how held, around the pointer', async ({ ctrlKey, metaKey }) => {
    const { host, viewports } = await mounted()

    wheel(host, { clientX: 200, clientY: 100, deltaY: -100, ctrlKey, metaKey })
    await nextFrame()

    // Falling back to the identity rather than asserting non-null: a wheel that published nothing
    // fails the scale below instead of throwing something unreadable.
    const next = viewports.at(-1) ?? { x: 0, y: 0, scale: 1 }
    expect(next.scale).toBeGreaterThan(1)
    // Whatever sat under the pointer is still under it — scaling without an anchor drags the
    // document away from the cursor, which is the regression this line exists for.
    const under = toDocument(next, { x: 200, y: 100 })
    expect(under.x).toBeCloseTo(200)
    expect(under.y).toBeCloseTo(100)
  })

  // Bare, it scrolls as it does in Figma: the document moves under a still pointer rather than
  // jumping a zoom step per notch.
  it('scrolls the document on its own', async () => {
    const { host, viewports } = await mounted()

    wheel(host, { deltaX: 30, deltaY: 40 })
    await nextFrame()

    expect(viewports.at(-1)).toMatchObject({ x: -30, y: -40, scale: 1 })
  })
})

/**
 * What the engine hands the overlay for the move tool. Nothing else exposes it: the grips are
 * chrome, they touch neither the document nor anything the engine publishes.
 */
describe('the grips offered on the armed layer', () => {
  /** Rulers and guides off, or their own bands and lines would answer instead of the grips. */
  const BARE = { ...VIEW_1_1, rulers: false, guides: false, snap: false }

  async function chromeOf(tool: CanvasTool, layer: Layer): Promise<number[][]> {
    const { fills } = overlayRecorder()
    const harness = await mounted(stacked([layer]), tool)

    // Twice: the first drains the frames mounting already booked, with the rulers still on.
    harness.engine.setView(BARE)
    await nextFrame()
    fills.length = 0
    harness.engine.setView(BARE)
    await nextFrame()

    return fills
  }

  // Eight, since the rotation moved out to a zone beyond each corner: a ninth square floating
  // above the box was indistinguishable from the eight that resize it.
  it('draws the eight of them while the move tool holds a free layer', async () => {
    expect(await chromeOf('move', layerFixture())).toHaveLength(8)
  })

  it('draws none of them once another tool is armed', async () => {
    expect(await chromeOf('brush', layerFixture())).toHaveLength(0)
  })

  it('draws none of them on a layer pinned in place', async () => {
    const pinned = layerFixture({ locked: { ...UNLOCKED, position: true } })

    expect(await chromeOf('move', pinned)).toHaveLength(0)
  })
})

/**
 * The ring under the hand, which says what the next dab will cover before it covers it. Same
 * split as the grips: the engine decides its radius, the overlay puts it on screen.
 */
describe('the brush ring', () => {
  /** Rulers off on purpose: they are the other reason the overlay repaints on a bare move. */
  const BARE = { ...VIEW_1_1, rulers: false, guides: false, snap: false }

  async function ringsAfterMoving(tool: CanvasTool, size?: number): Promise<number[][]> {
    const { rings } = overlayRecorder()
    const harness = await mounted(DEFAULT_CANVAS, tool)
    harness.engine.setView(BARE)
    if (size !== undefined) harness.engine.setBrush({ ...DEFAULT_BRUSH, size })
    await nextFrame()

    rings.length = 0
    drag(harness.host, 120, 90)
    await nextFrame()
    return rings
  }

  it('rings the hand while the brush is armed', async () => {
    const rings = await ringsAfterMoving('brush', 40)

    expect(rings).toHaveLength(2)
    // Half the brush: the setting is a diameter, and the ring is the footprint of one dab.
    expect(rings[0]).toEqual([120, 90, 20])
  })

  it('rings the hand for the eraser too, which lays down the same disc', async () => {
    expect(await ringsAfterMoving('eraser', 40)).toHaveLength(2)
  })

  it('leaves the hand bare under a tool that lays down no disc', async () => {
    expect(await ringsAfterMoving('move')).toHaveLength(0)
    expect(await ringsAfterMoving('select')).toHaveLength(0)
    expect(await ringsAfterMoving('crop')).toHaveLength(0)
  })

  /**
   * The overlay used to repaint on an idle move only to echo the pointer on the rulers. With
   * them off, the ring would have been painted once and then stood still while the hand moved.
   */
  it('follows the hand with the rulers off', async () => {
    const { rings } = overlayRecorder()
    const harness = await mounted(DEFAULT_CANVAS, 'brush')
    harness.engine.setView(BARE)
    await nextFrame()

    drag(harness.host, 100, 100)
    await nextFrame()
    rings.length = 0
    drag(harness.host, 160, 140)
    await nextFrame()

    expect(rings[0]?.slice(0, 2)).toEqual([160, 140])
  })

  // Dragging the size slider must show the new footprint at once: waiting for the next twitch
  // of the mouse is what makes a slider feel disconnected from what it sets.
  it('resizes under a still hand when the setting changes', async () => {
    const { rings } = overlayRecorder()
    const harness = await mounted(DEFAULT_CANVAS, 'brush')
    harness.engine.setView(BARE)
    drag(harness.host, 100, 100)
    await nextFrame()

    rings.length = 0
    harness.engine.setBrush({ ...DEFAULT_BRUSH, size: 64 })
    await nextFrame()

    expect(rings[0]).toEqual([100, 100, 32])
  })

  it('drops the ring once the hand leaves the canvas', async () => {
    const { rings } = overlayRecorder()
    const harness = await mounted(DEFAULT_CANVAS, 'brush')
    harness.engine.setView(BARE)
    drag(harness.host, 100, 100)
    await nextFrame()

    rings.length = 0
    harness.host.dispatchEvent(new PointerEvent('pointerleave'))
    await nextFrame()

    expect(rings).toHaveLength(0)
  })
})
