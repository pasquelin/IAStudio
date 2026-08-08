import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TILE_SIZE, tileBytes } from './tiles'

/**
 * jsdom has no WebGL, so Pixi is doubled — the same bargain `CanvasEngine.test` strikes. What is
 * tested is the bookkeeping: which tiles are photographed, how often, in what order they are
 * thrown away, and what is destroyed on the way out. Whether the blit lands the right pixels is
 * a question only a GPU can answer.
 */
const gpu = { created: 0, destroyed: 0 }

/** Every render call, as `clear:<bool> children:<n>` — enough to tell a capture from a restore. */
const passes: string[] = []

vi.mock('pixi.js', () => {
  class Container {
    readonly children: object[] = []
    readonly position = { set: vi.fn() }
    blendMode = 'normal'

    addChild(child: object): void {
      this.children.push(child)
    }

    destroy(): void {}
  }

  class Graphics extends Container {
    rect(): this {
      return this
    }
    fill(): this {
      return this
    }
  }

  class TextureDouble {
    destroy(): void {}
  }

  return {
    Container,
    Graphics,
    Rectangle: class {},
    Sprite: class extends Container {},
    Texture: TextureDouble,
    RenderTexture: {
      create: () => {
        gpu.created += 1
        return {
          source: {},
          destroy: () => {
            gpu.destroyed += 1
          },
        }
      },
    },
  }
})

const { PixelPatches } = await import('./PixelPatches')
const { RenderTexture } = await import('pixi.js')

const DOCUMENT = { width: 1024, height: 1024 }

/** The layer's own texture, which is never one of the store's. */
function surface() {
  return RenderTexture.create({ width: DOCUMENT.width, height: DOCUMENT.height })
}

function store(budget?: number) {
  const dropped: string[] = []
  const renderer = {
    render: (options: { clear: boolean; container: { children: object[] } }) =>
      passes.push(`clear:${options.clear} children:${options.container.children.length}`),
  }
  return { patches: new PixelPatches(renderer, id => dropped.push(id), budget), dropped }
}

beforeEach(() => {
  gpu.created = 0
  gpu.destroyed = 0
  passes.length = 0
})

describe('recording', () => {
  it('photographs a tile the first time it is dirtied and never again', () => {
    const { patches } = store()
    const layer = surface()
    const before = gpu.created

    patches.begin('p1', 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 10, y: 10, width: 20, height: 20 })
    patches.touch({ x: 12, y: 12, width: 20, height: 20 })

    expect(gpu.created - before).toBe(1)
  })

  it('photographs every tile a wide stroke crosses', () => {
    const { patches } = store()
    const layer = surface()
    const before = gpu.created

    patches.begin('p1', 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 500, y: 500, width: 40, height: 40 })

    expect(gpu.created - before).toBe(4)
  })

  // The second photograph of each tile is what a redo puts back.
  it('takes a second photograph of each tile when the gesture ends', () => {
    const { patches } = store()
    const layer = surface()

    patches.begin('p1', 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 10, y: 10, width: 20, height: 20 })
    const created = gpu.created
    const id = patches.end()

    expect(id).toBe('p1')
    expect(gpu.created - created).toBe(1)
  })

  it('records nothing for a gesture that dirtied no tile', () => {
    const { patches } = store()
    patches.begin('p1', 'layer-1', surface(), DOCUMENT)

    expect(patches.end()).toBeNull()
  })

  it('throws away a recording that a second one interrupts', () => {
    const { patches } = store()
    const layer = surface()

    patches.begin('p1', 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 10, y: 10, width: 20, height: 20 })
    const destroyed = gpu.destroyed
    patches.begin('p2', 'layer-1', layer, DOCUMENT)

    expect(gpu.destroyed - destroyed).toBe(1)
    expect(patches.recordingId).toBe('p2')
  })

  it('names the layer a patch belongs to, so the engine can find its texture', () => {
    const { patches } = store()
    patches.begin('p1', 'layer-7', surface(), DOCUMENT)
    patches.touch({ x: 0, y: 0, width: 4, height: 4 })
    patches.end()

    expect(patches.surfaceOf('p1')).toBe('layer-7')
    expect(patches.surfaceOf('nope')).toBeNull()
  })
})

describe('restoring', () => {
  it('replays one pass per captured tile', () => {
    const { patches } = store()
    const layer = surface()

    patches.begin('p1', 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 500, y: 500, width: 40, height: 40 })
    patches.end()
    passes.length = 0

    expect(patches.restore('p1', 'before', layer)).toBe(true)
    // Two children a pass: the hole that erases the region, then the tile that fills it. Drawing
    // the tile alone would blend the old stroke with the new one instead of replacing it.
    expect(passes).toEqual(Array.from({ length: 4 }, () => 'clear:false children:2'))
  })

  it('says so rather than pretending when the patch is gone', () => {
    const { patches } = store()

    expect(patches.restore('never-recorded', 'before', surface())).toBe(false)
  })
})

describe('the budget', () => {
  // Two textures a tile — the state before the gesture and the state after — so one full tile of
  // budget holds exactly one single-tile patch.
  const ONE_TILE = tileBytes({ column: 0, row: 0, x: 0, y: 0, width: TILE_SIZE, height: TILE_SIZE })

  function record(
    patches: InstanceType<typeof PixelPatches>,
    id: string,
    layer: ReturnType<typeof surface>,
  ): void {
    patches.begin(id, 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 10, y: 10, width: 20, height: 20 })
    patches.end()
  }

  it('throws the oldest patch away and reports it', () => {
    const { patches, dropped } = store(ONE_TILE * 2)
    const layer = surface()

    record(patches, 'p1', layer)
    record(patches, 'p2', layer)

    expect(dropped).toEqual(['p1'])
    expect(patches.restore('p1', 'before', layer)).toBe(false)
    expect(patches.restore('p2', 'before', layer)).toBe(true)
  })

  it('destroys the tiles of what it throws away', () => {
    const { patches } = store(ONE_TILE * 2)
    const layer = surface()

    record(patches, 'p1', layer)
    const destroyed = gpu.destroyed
    record(patches, 'p2', layer)

    // Both photographs of the dropped patch's single tile.
    expect(gpu.destroyed - destroyed).toBe(2)
  })

  it('never throws away the gesture in flight, which has nothing to fall back on', () => {
    const { patches, dropped } = store(1)
    const layer = surface()

    patches.begin('p1', 'layer-1', layer, DOCUMENT)
    patches.touch({ x: 10, y: 10, width: 20, height: 20 })

    expect(dropped).toEqual([])
    expect(patches.recordingId).toBe('p1')
  })

  it('destroys everything it holds when the engine goes', () => {
    const { patches } = store()
    const layer = surface()

    record(patches, 'p1', layer)
    record(patches, 'p2', layer)
    const destroyed = gpu.destroyed
    patches.dispose()

    expect(gpu.destroyed - destroyed).toBe(4)
    expect(patches.restore('p1', 'before', layer)).toBe(false)
  })
})
