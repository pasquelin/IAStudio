import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Mounting, with a Pixi jsdom cannot give us: `Application.init` needs a WebGL context, and
 * what matters here is what the engine does around that await, not what Pixi draws.
 *
 * In its own file because the mock replaces the whole module, and the rest of the suite
 * exercises the real `Sprite` and `Texture`.
 */
const destroy = vi.fn()
const render = vi.fn()
const on = vi.fn<(event: string, listener: () => void) => void>()
const off = vi.fn()
let resolveInit: (() => void) | null = null
let started: Record<string, unknown> | null = null

vi.mock('pixi.js', () => ({
  Application: class {
    canvas = document.createElement('canvas')
    stage = { addChild: vi.fn() }
    screen = { width: 800, height: 450 }
    renderer = { on, off, texture: { initSource: vi.fn() } }
    destroy = destroy
    render = render
    init = (options: Record<string, unknown>): Promise<void> => {
      started = options
      return new Promise(resolve => (resolveInit = () => resolve()))
    }
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
    started = null
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  const mounted = async (engine: InstanceType<typeof TimelineEngine>): Promise<void> => {
    const mounting = engine.mount(host)
    resolveInit?.()
    await mounting
  }

  it('attaches its canvas once Pixi is ready', async () => {
    await mounted(engineFor(host))

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

  /**
   * A paused sequence holds one still frame. Pixi's ticker defaults to on, and would redraw
   * that frame sixty times a second for a monitor nobody is watching — Dockview keeps the tab
   * mounted, so a background document would burn the GPU on its own.
   */
  it("never starts Pixi's own ticker", async () => {
    await mounted(engineFor(host))

    expect(started).toMatchObject({ autoStart: false })
  })

  it('draws once, when its canvas is attached', async () => {
    await mounted(engineFor(host))

    expect(render).toHaveBeenCalledTimes(1)
  })

  it('draws what a seek left on the stage', async () => {
    const engine = engineFor(host)
    await mounted(engine)
    render.mockClear()

    await engine.seek(0)

    expect(render).toHaveBeenCalledTimes(1)
  })

  /**
   * Pixi renders itself right after emitting `resize`, so the listener only lays out. It must
   * still come off by the same reference — one kept listener per remount is a leaked monitor.
   */
  it('takes its resize listener back off on dispose', async () => {
    const engine = engineFor(host)
    await mounted(engine)
    engine.dispose()

    const listener = on.mock.calls.find(([event]) => event === 'resize')?.[1]
    expect(listener).toBeDefined()
    expect(off).toHaveBeenCalledWith('resize', listener)
  })

  it('draws nothing once it is disposed', async () => {
    const engine = engineFor(host)
    await mounted(engine)
    engine.dispose()
    render.mockClear()

    await engine.seek(0)

    expect(render).not.toHaveBeenCalled()
  })
})
