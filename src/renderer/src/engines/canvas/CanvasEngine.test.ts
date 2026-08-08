import { beforeEach, describe, expect, it, vi } from 'vitest'
import { layerFixture } from './canvas-fixtures'
import {
  BLEND_MODES,
  DEFAULT_CANVAS,
  groupLayer,
  IDENTITY,
  isGroup,
  pixelLayer,
  type CanvasState,
  type Layer,
  type Transform,
} from './canvas-state'
import type { CanvasSelection } from './canvas-selection'
import { RULER_SIZE } from './CanvasOverlay'
import { DEFAULT_VIEW, type Viewport } from './viewport'

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
}

vi.mock('pixi.js/unsafe-eval', () => ({}))
vi.mock('pixi.js/advanced-blend-modes', () => ({}))

vi.mock('pixi.js', () => {
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

    removeChildren(): void {
      gpu.mutations += this.children.length
      for (const child of this.children) child.parent = null
      this.children.length = 0
    }

    destroy(): void {}
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
        extract: { pixels: () => ({ pixels: [0, 0, 0, 0] }) },
      }

      async init(options: Record<string, unknown>): Promise<void> {
        gpu.init = options
      }
      destroy(): void {}
    },
    Filter: { defaultOptions: { resolution: 1 } },
    AlphaFilter: class {
      destroy(): void {}
    },
    Container,
    Graphics,
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
        return Promise.resolve({ width: 200, height: 100 })
      },
    },
    Rectangle: class {},
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
  guides: { calls: string[] }
  /** The ids of the patches the engine reported as one finished gesture each. */
  patches: string[]
  /** `translate:<id>:<x>:<y>` and the two ends of the drag, in the order they arrived. */
  layers: string[]
}

function mounted(state: CanvasState = DEFAULT_CANVAS): Promise<Harness> {
  const host = document.createElement('div')
  document.body.appendChild(host)

  const viewports: Viewport[] = []
  const selections: CanvasSelection[] = []
  const calls: string[] = []
  const patches: string[] = []
  const layers: string[] = []
  const harness: Harness = {
    engine: new CanvasEngine({
      onPick: () => undefined,
      onPixels: patchId => patches.push(patchId),
      onPixelsDropped: () => undefined,
      onViewport: viewport => viewports.push(viewport),
      onSelection: selection => selections.push(selection),
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
        translate: (id, x, y) => layers.push(`translate:${id}:${Math.round(x)}:${Math.round(y)}`),
        beginDrag: () => layers.push('begin'),
        endDrag: () => layers.push('end'),
      },
    }),
    host,
    viewports,
    selections,
    guides: { calls },
    patches,
    layers,
  }

  harness.engine.setView(DEFAULT_VIEW)
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

    expect(selections.at(-1)?.kind).toBe('rect')
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

  it('cuts the bucket the same way, which is what makes it fill a region', async () => {
    const { engine, host } = await mounted()
    engine.setTool('fill')
    engine.setSelection({ kind: 'ellipse', rect: { x: 0, y: 0, width: 100, height: 100 } })
    gpu.containers = []

    press(host, 200, 200)

    expect(stencilled()).toBe(true)
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

/** `pointermove` goes to the host, `pointerup` to the window — as the engine listens for them. */
function drag(host: HTMLElement, x: number, y: number, shiftKey = false): void {
  host.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, shiftKey }))
}

function release(x = 400, y = 400): void {
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }))
}

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
