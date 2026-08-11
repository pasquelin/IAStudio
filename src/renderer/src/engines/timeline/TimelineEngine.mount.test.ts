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
/** Every sprite starts on the empty texture, as it does in Pixi — `swapTexture` reads it. */
const EMPTY_TEXTURE = {}
const PAINTED_TEXTURE = { source: {}, width: 8, height: 6, destroy: vi.fn() }

vi.mock('pixi.js/advanced-blend-modes', () => ({}))

vi.mock('pixi.js', () => ({
  // `mount` sets the global filter resolution on import, for the advanced blend modes.
  Filter: { defaultOptions: { resolution: 1 } },
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
    texture = EMPTY_TEXTURE
    position = { set: vi.fn() }
    scale = { set: vi.fn() }
  },
  Texture: { EMPTY: EMPTY_TEXTURE, from: () => PAINTED_TEXTURE },
}))

const { TimelineEngine } = await import('./TimelineEngine')
const { clipFixture, sequenceWith, trackFixture } = await import('./timeline-fixtures')

const engineFor = (host: HTMLElement, onUnreadable?: (unreadable: boolean) => void) =>
  new TimelineEngine({
    openSink: () => Promise.reject(new Error('no decoder in a test')),
    maxDecoders: 1,
    maxPictures: 1,
    owner: host.id,
    onUnreadable,
  })

// jsdom has no WebCodecs, so a frame is the one method the engine calls on it.
const fakeFrame = (): VideoFrame => ({ close: vi.fn() }) as unknown as VideoFrame

/** A monitor where `readable` decodes and everything else does not. */
const engineOver = (
  host: HTMLElement,
  readable: string,
  onUnreadable: (unreadable: boolean) => void,
) =>
  new TimelineEngine({
    openSink: assetId =>
      assetId === readable
        ? Promise.resolve({
            getSample: async () => ({ toVideoFrame: fakeFrame, close: vi.fn() }),
            close: vi.fn(),
            holdsDecoder: true,
          })
        : Promise.reject(new Error('no decoder in a test')),
    maxDecoders: 2,
    maxPictures: 2,
    owner: host.id,
    onUnreadable,
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

  /**
   * `.exr`, `.tif` and `.tiff` are catalogued as pictures and Chromium decodes none of them.
   * Before this, the clip was simply not painted and nothing on screen said why.
   */
  it('reports a clip whose media cannot be decoded', async () => {
    const onUnreadable = vi.fn()
    const engine = engineFor(host, onUnreadable)
    await mounted(engine)
    engine.apply(sequenceWith([trackFixture('V1', 'video', [clipFixture('c', 0, 1_000_000)])]))

    await engine.seek(0)

    expect(onUnreadable).toHaveBeenLastCalledWith(true)
  })

  /**
   * The order production runs in: React applies the sequence in the same commit that starts the
   * mount, and `seek` returns on an application that is not there yet. Nothing asked again, so
   * the picture — and the message — waited for the playhead to move.
   */
  it('paints what sits under the playhead as soon as Pixi is ready', async () => {
    const onUnreadable = vi.fn()
    const engine = engineFor(host, onUnreadable)
    const mounting = engine.mount(host)
    engine.apply(sequenceWith([trackFixture('V1', 'video', [clipFixture('c', 0, 1_000_000)])]))

    resolveInit?.()
    await mounting

    await vi.waitFor(() => expect(onUnreadable).toHaveBeenLastCalledWith(true))
  })

  /**
   * The message covers the whole monitor. Laid over a track that did decode, it would hide a
   * picture that is perfectly fine to say something is wrong with another one.
   */
  it('stays silent when a track under the unreadable one did paint', async () => {
    const onUnreadable = vi.fn()
    const engine = engineOver(host, 'asset-fine', onUnreadable)
    await mounted(engine)
    engine.apply(
      sequenceWith([
        trackFixture('V1', 'video', [clipFixture('fine', 0, 1_000_000)], { index: 1 }),
        trackFixture('V2', 'video', [clipFixture('broken', 0, 1_000_000)], { index: 2 }),
      ]),
    )

    await engine.seek(0)

    expect(onUnreadable).toHaveBeenLastCalledWith(false)
  })

  it('takes the report back where the playhead leaves the clip', async () => {
    const onUnreadable = vi.fn()
    const engine = engineFor(host, onUnreadable)
    await mounted(engine)
    engine.apply(sequenceWith([trackFixture('V1', 'video', [clipFixture('c', 0, 1_000_000)])]))
    await engine.seek(0)

    await engine.seek(2_000_000)

    // A message raised over an unreadable clip has to fall again on the gap that follows it.
    expect(onUnreadable).toHaveBeenLastCalledWith(false)
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
