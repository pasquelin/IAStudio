import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Mounting, with a Pixi jsdom cannot give us: `Application.init` needs a WebGL context, and
 * what matters here is what the engine does around that await, not what Pixi draws.
 *
 * In its own file because the mock replaces the whole module, and the rest of the suite
 * exercises the real `Sprite` and `Texture`.
 */
const destroy = vi.fn()
let resolveInit: (() => void) | null = null

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = document.createElement('canvas')
    stage = { addChild: vi.fn() }
    screen = { width: 800, height: 450 }
    renderer = { on: vi.fn(), off: vi.fn(), texture: { initSource: vi.fn() } }
    destroy = destroy
    init = (): Promise<void> => new Promise(resolve => (resolveInit = () => resolve()))
  },
  Container: class {
    addChild = vi.fn()
    position = { set: vi.fn() }
    scale = { set: vi.fn() }
  },
  Graphics: class {
    clear = (): this => this
    rect = (): this => this
    fill = (): this => this
  },
  Sprite: class {
    position = { set: vi.fn() }
    scale = { set: vi.fn() }
  },
  Texture: { EMPTY: {} },
}))

const { TimelineEngine } = await import('./TimelineEngine')

const engineFor = (host: HTMLElement) =>
  new TimelineEngine({
    openSink: () => Promise.reject(new Error('no decoder in a test')),
    maxDecoders: 1,
    owner: host.id,
  })

describe('mounting a monitor', () => {
  let host: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    resolveInit = null
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  it('attaches its canvas once Pixi is ready', async () => {
    const engine = engineFor(host)
    const mounting = engine.mount(host)

    resolveInit?.()
    await mounting

    expect(host.querySelector('canvas')).not.toBeNull()
  })

  /**
   * React mounts, unmounts and remounts an effect on the very same element. Left to
   * `isConnected` alone, the element is still connected when the first `init` resolves, and its
   * canvas joins the one the second mount added — a WebGL context leaked per monitor, per tab.
   */
  it('attaches nothing when it was disposed while Pixi was still starting', async () => {
    const engine = engineFor(host)
    const mounting = engine.mount(host)

    engine.dispose()
    resolveInit?.()
    await mounting

    expect(host.querySelector('canvas')).toBeNull()
    expect(destroy).toHaveBeenCalled()
  })
})
