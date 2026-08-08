import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BLEND_MODES,
  DEFAULT_CANVAS,
  groupLayer,
  IDENTITY,
  pixelLayer,
  type CanvasState,
  type Layer,
  type Transform,
} from './canvas-state'
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
  readonly children: object[]
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
} = {
  renders: 0,
  texturesCreated: 0,
  texturesDestroyed: 0,
  mutations: 0,
  init: {},
  sprites: [],
  containers: [],
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
    readonly children: object[] = []
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
    x = 0
    y = 0

    constructor(options: { label?: string } = {}) {
      this.label = options.label ?? ''
      gpu.containers.push(this)
    }

    addChild(child: object): void {
      gpu.mutations += 1
      this.children.push(child)
    }

    removeChild(child: object): void {
      const at = this.children.indexOf(child)
      if (at < 0) return
      gpu.mutations += 1
      this.children.splice(at, 1)
    }

    removeChildren(): void {
      gpu.mutations += this.children.length
      this.children.length = 0
    }

    destroy(): void {}
  }

  class Graphics extends Container {
    clear(): this {
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
        render: () => {
          gpu.renders += 1
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
    Rectangle: class {},
    Texture: class {},
    RenderTexture: {
      create: (options: { width: number; height: number }) => {
        gpu.texturesCreated += 1
        return {
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
  const calls: string[] = []
  const patches: string[] = []
  const layers: string[] = []
  const harness: Harness = {
    engine: new CanvasEngine({
      onPick: () => undefined,
      onPixels: patchId => patches.push(patchId),
      onPixelsDropped: () => undefined,
      onViewport: viewport => viewports.push(viewport),
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

function press(host: HTMLElement, x: number, y: number, button = 0): void {
  host.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, button }))
}

/** How many tree mutations happen from here on, read when the assertion needs it. */
function mutationsCounted(): () => number {
  const before = gpu.mutations
  return () => gpu.mutations - before
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
})

describe('the blend table', () => {
  // A mode missing from the table falls back to 'normal' silently: the layer composites wrongly
  // and nothing says so. Eleven of the sixteen did exactly that until the extension was imported.
  it('gives every declared blend mode a Pixi mode of its own', () => {
    for (const mode of BLEND_MODES) expect(BLEND_BY_MODE[mode]).toBeDefined()
  })

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

    expect(world()).toBeGreaterThan(0)
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
  const grouped = (children: Layer[]): CanvasState => ({
    ...DEFAULT_CANVAS,
    layers: [groupLayer('g', 'G', children)],
    activeLayerId: children[0]?.id ?? null,
  })

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
    const { engine } = await mounted({ ...DEFAULT_CANVAS, layers: [passing], activeLayerId: 'a' })
    expect(groupContainer('g')?.filters).toEqual([])

    engine.apply({
      ...DEFAULT_CANVAS,
      layers: [{ ...passing, isolation: 'isolate' }],
      activeLayerId: 'a',
    })
    expect(groupContainer('g')?.filters).toHaveLength(1)
  })

  it('drops the container of a group that left the stack', async () => {
    const { engine } = await mounted(grouped([pixelLayer('a', 'A')]))

    engine.apply({ ...DEFAULT_CANVAS, layers: [pixelLayer('a', 'A')], activeLayerId: 'a' })

    expect(groupContainer('g')?.children).toHaveLength(0)
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
