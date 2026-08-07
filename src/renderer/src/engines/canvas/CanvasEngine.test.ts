import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CANVAS, pixelLayer, type CanvasState } from './canvas-state'
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
const gpu = {
  renders: 0,
  texturesCreated: 0,
  texturesDestroyed: 0,
}

vi.mock('pixi.js/unsafe-eval', () => ({}))

vi.mock('pixi.js', () => {
  class Container {
    readonly children: object[] = []
    readonly position = { set: vi.fn() }
    readonly scale = { set: vi.fn() }
    visible = true
    alpha = 1
    blendMode = 'normal'
    x = 0
    y = 0

    addChild(child: object): void {
      this.children.push(child)
    }

    removeChild(child: object): void {
      const at = this.children.indexOf(child)
      if (at >= 0) this.children.splice(at, 1)
    }

    setChildIndex(child: object, index: number): void {
      this.removeChild(child)
      this.children.splice(index, 0, child)
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

      async init(): Promise<void> {}
      destroy(): void {}
    },
    Container,
    Graphics,
    Sprite: class extends Container {},
    Rectangle: class {},
    RenderTexture: {
      create: () => {
        gpu.texturesCreated += 1
        return {
          destroy: () => {
            gpu.texturesDestroyed += 1
          },
        }
      },
    },
  }
})

const { CanvasEngine } = await import('./CanvasEngine')

type Harness = {
  engine: InstanceType<typeof CanvasEngine>
  host: HTMLElement
  viewports: Viewport[]
  guides: { calls: string[] }
  strokes: number
}

function mounted(state: CanvasState = DEFAULT_CANVAS): Promise<Harness> {
  const host = document.createElement('div')
  document.body.appendChild(host)

  const viewports: Viewport[] = []
  const calls: string[] = []
  const harness: Harness = {
    engine: new CanvasEngine({
      onPick: () => undefined,
      onStrokeEnd: () => {
        harness.strokes += 1
      },
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
    }),
    host,
    viewports,
    guides: { calls },
    strokes: 0,
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

beforeEach(() => {
  gpu.renders = 0
  gpu.texturesCreated = 0
  gpu.texturesDestroyed = 0
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

  // A guide drag rewrites the state on every pointer move and touches no pixel.
  it('does not walk the stack again for a state whose layers are the same', async () => {
    const { engine } = await mounted()
    const renders = gpu.renders

    engine.apply({ ...DEFAULT_CANVAS, guides: [{ id: 'g', axis: 'x', position: 10 }] })

    expect(gpu.texturesCreated).toBe(1)
    expect(gpu.renders).toBe(renders)
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
