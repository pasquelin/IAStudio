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
const resizeCall = vi.fn()
const on = vi.fn<(event: string, listener: () => void) => void>()
const off = vi.fn()
let resolveInit: (() => void) | null = null
let started: Record<string, unknown> | null = null
/** Every sprite starts on the empty texture, as it does in Pixi — `swapTexture` reads it. */
const EMPTY_TEXTURE = {}
const PAINTED_TEXTURE = { source: {}, width: 8, height: 6, destroy: vi.fn() }
/** Every sprite the engine builds, in order: the map that holds them is its own business. */
const sprites: { visible: boolean; texture: unknown; zIndex: number }[] = []
/** Every container it builds, in order. The first is the frame every sprite is added to. */
const containers: { sortableChildren: boolean }[] = []

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
    resize = resizeCall
    init = (options: Record<string, unknown>): Promise<void> => {
      started = options
      return new Promise(resolve => (resolveInit = () => resolve()))
    }
  },
  Container: class {
    addChild = vi.fn()
    position = { set: vi.fn() }
    scale = { set: vi.fn() }
    // Pixi bulk-copies its options onto the instance; only this one is read back here.
    sortableChildren = false
    constructor(options: { sortableChildren?: boolean } = {}) {
      this.sortableChildren = options.sortableChildren ?? false
      containers.push(this)
    }
  },
  Graphics: class {
    zIndex = 0
    clear = (): this => this
    rect = (): this => this
    fill = (): this => this
  },
  Sprite: class {
    texture = EMPTY_TEXTURE
    visible = true
    zIndex = 0
    position = { set: vi.fn() }
    scale = { set: vi.fn() }
    constructor() {
      sprites.push(this)
    }
  },
  Texture: { EMPTY: EMPTY_TEXTURE, from: () => PAINTED_TEXTURE },
}))

/**
 * A `ResizeObserver` a test can shake, which the suite's own stub is not: that one reports once
 * on `observe` and never again, and what is under test here is precisely the second report — the
 * one a Dockview splitter causes and a window resize does not.
 */
const watching = new Set<{ target: Element; notify: () => void }>()

class TestResizeObserver {
  private entry: { target: Element; notify: () => void } | null = null

  constructor(private readonly callback: () => void) {}

  observe(target: Element): void {
    this.entry = { target, notify: this.callback }
    watching.add(this.entry)
    // The real one reports the current size straight away, and the engine lays out on it.
    this.callback()
  }

  unobserve(): void {}

  disconnect(): void {
    if (this.entry) watching.delete(this.entry)
    this.entry = null
  }
}

// `as`: the stub answers the three methods this file uses, not the full DOM interface.
globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

/** Reports a new size to whoever is still watching `host`. Nobody left means nothing fires. */
const resize = (host: Element): void => {
  for (const observer of watching) if (observer.target === host) observer.notify()
}

const { TimelineEngine } = await import('./TimelineEngine')
const { clipFixture, sequenceWith, settled, trackFixture } = await import('./timeline-fixtures')
const { reindexTracks } = await import('./timelineState')

/** No output in jsdom: the suite plays nothing, and every load is refused. */
const silence = () => ({
  now: () => null,
  tap: () => null,
  resume: vi.fn(),
  load: () => Promise.reject(new Error('no output')),
})

const engineFor = (host: HTMLElement, onUnreadable?: (unreadable: boolean) => void) =>
  new TimelineEngine({
    openSink: () => Promise.reject(new Error('no decoder in a test')),
    sound: silence(),
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
            stable: false,
          })
        : Promise.reject(new Error('no decoder in a test')),
    sound: silence(),
    maxDecoders: 2,
    maxPictures: 2,
    owner: host.id,
    onUnreadable,
  })

describe('mounting a monitor', () => {
  let host: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
    sprites.length = 0
    containers.length = 0
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
   * The defect this replaced: Pixi honours `resizeTo` through a `window.resize` listener and
   * nothing else, so dragging a Dockview splitter — which resizes the panel and not the window —
   * left the drawing buffer at its mounted size. The picture was then letterboxed against a
   * rectangle that no longer existed, and did not move by a pixel while the panel grew.
   */
  it('follows the panel it sits in, which no window resize announces', async () => {
    await mounted(engineFor(host))
    resizeCall.mockClear()

    resize(host)

    expect(resizeCall).toHaveBeenCalledTimes(1)
  })

  it('stops following it once disposed, so a closed tab holds neither observer nor canvas', async () => {
    const engine = engineFor(host)
    await mounted(engine)
    resizeCall.mockClear()

    engine.dispose()
    resize(host)

    expect(resizeCall).not.toHaveBeenCalled()
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
   * A track that LEAVES the frame keeps the image it last painted, and the paint loop never
   * reaches it again — it walks the tracks still in. The source monitor turns its one track from
   * picture to sound when the selection moves from a rush to a take, and the rush's last frame
   * would sit on screen over another clip's sound.
   */
  it('takes the picture down when a track stops being a picture track', async () => {
    const engine = engineOver(host, 'asset-c', vi.fn())
    await mounted(engine)
    engine.apply(sequenceWith([trackFixture('V1', 'video', [clipFixture('c', 0, 1_000_000)])]))
    await engine.seek(0)
    expect(sprites.at(-1)?.visible).toBe(true)

    engine.apply(sequenceWith([trackFixture('V1', 'audio', [clipFixture('c', 0, 1_000_000)])]))
    await engine.seek(0)

    expect(sprites.at(-1)?.visible).toBe(false)
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

  /**
   * The defect: a sprite joins the frame the FIRST time its track is painted, so the children
   * were stacked in the order the tracks first carried something. V2, opened by a drop under V1
   * — which already had a sprite — composited over it, and the montage showed the row the column
   * says is underneath. Depth is therefore restated on every seek rather than at creation.
   */
  it('keeps the row highest in the column on top, however late its track was opened', async () => {
    const engine = engineFor(host)
    await mounted(engine)
    engine.apply(sequenceWith([trackFixture('V1', 'video', [clipFixture('a', 0, 1_000_000)])]))
    await engine.seek(0)

    engine.apply(
      sequenceWith(
        reindexTracks([
          trackFixture('V1', 'video', [clipFixture('a', 0, 1_000_000)]),
          trackFixture('V2', 'video', [clipFixture('b', 0, 1_000_000)]),
        ]),
      ),
    )
    await engine.seek(0)

    const [v1, v2] = sprites
    expect(v1?.zIndex).toBeGreaterThan(v2?.zIndex ?? 0)
  })

  // And the other half of the same question: a track dragged to another row keeps neither its
  // old depth nor the order it was created in.
  it('follows a track dragged to another row', async () => {
    const engine = engineFor(host)
    await mounted(engine)
    const rows = (top: string, under: string) =>
      sequenceWith(
        reindexTracks([
          trackFixture(top, 'video', [clipFixture(top, 0, 1_000_000)]),
          trackFixture(under, 'video', [clipFixture(under, 0, 1_000_000)]),
        ]),
      )

    engine.apply(rows('V1', 'V2'))
    await engine.seek(0)
    engine.apply(rows('V2', 'V1'))
    await engine.seek(0)

    const [v1, v2] = sprites
    expect(v2?.zIndex).toBeGreaterThan(v1?.zIndex ?? 0)
  })

  // zIndex alone reorders nothing: Pixi renders children in array order unless the parent sorts.
  it('sorts the frame it stacks them in', async () => {
    await mounted(engineFor(host))

    expect(containers[0]?.sortableChildren).toBe(true)
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

  /**
   * A transport whose decodes are driven by hand, one frame at a time, already showing the
   * still under its playhead — which is the state a monitor is in when play is pressed.
   */
  const playerOver = async (
    host: HTMLElement,
    onTime?: (time: number) => void,
  ): Promise<{
    engine: InstanceType<typeof TimelineEngine>
    /** Runs the frame the loop has asked for, and answers the decode it starts. */
    tick: () => Promise<void>
    /** The animation frames asked for and not yet run. */
    frames: (() => void)[]
  }> => {
    const pending: ((sample: { toVideoFrame: () => VideoFrame; close: () => void }) => void)[] = []
    const frames: (() => void)[] = []
    vi.stubGlobal('requestAnimationFrame', (step: () => void) => frames.push(step))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const engine = new TimelineEngine({
      openSink: () =>
        Promise.resolve({
          getSample: () => new Promise(resolve => pending.push(resolve)),
          close: vi.fn(),
          holdsDecoder: true,
          stable: false,
        }),
      sound: silence(),
      maxDecoders: 1,
      maxPictures: 1,
      owner: host.id,
      ...(onTime ? { onTime } : {}),
    })

    // `settled` between the two, which is a macrotask: a decode is several awaits deep, and
    // counting microtasks here would tie the test to how many the pool happens to take.
    const tick = async (): Promise<void> => {
      frames.shift()?.()
      await settled()
      pending.shift()?.({ toVideoFrame: fakeFrame, close: vi.fn() })
      await settled()
    }

    await mounted(engine)
    engine.apply(sequenceWith([trackFixture('V1', 'video', [clipFixture('c', 0, 10_000_000)])]))
    // `apply` seeks on a paused monitor: that decode is answered here, so the frames below are
    // the transport's own and nothing is left in flight from before it started.
    await tick()

    return { engine, tick, frames }
  }

  /**
   * A decode outlasting a frame is the ordinary case, not the edge one: a hardware decoder
   * answers a seek in tens of milliseconds where a frame lasts sixteen. Asked again every frame,
   * each seek bumped the generation the one before it was awaiting on, and every decoded frame
   * was closed unpainted on return — the picture froze where the first miss happened, and a
   * pause was what finally showed the right one.
   *
   * Both bounds matter: none painted is that freeze, more than one per frame is a queue of asks
   * on a decoder that cannot keep up, each holding a frame the pool has to keep alive.
   */
  it('paints one frame per transport frame, when a decode outlasts the frame it belongs to', async () => {
    const { engine, tick } = await playerOver(host)
    render.mockClear()

    engine.play()
    await tick()
    await tick()
    engine.pause()
    vi.unstubAllGlobals()

    // Two frames asked for, two painted: a third draw would mean a seek nobody waited for.
    expect(render).toHaveBeenCalledTimes(2)
  })

  /**
   * A frame is mostly spent inside a decode, where there is no animation frame left for `pause`
   * to cancel. Pausing there and playing again started a second chain over the first, and from
   * then on every frame issued two seeks that invalidated each other — the freeze again, this
   * time unreachable by another pause.
   */
  it('starts one loop, not two, when play follows a pause taken mid-decode', async () => {
    const { engine, tick, frames } = await playerOver(host)

    engine.play()
    // Paused with a decode in flight: the loop is between two animation frames.
    frames.shift()?.()
    await settled()
    engine.pause()
    engine.play()
    await tick()
    engine.pause()
    vi.unstubAllGlobals()

    // One chain asked for one frame. Two would have queued a second animation frame here.
    expect(frames).toHaveLength(0)
  })

  /**
   * The playhead stops ON the end of the sequence, where the loop's first test sends it right
   * back to pause: pressing play there did nothing whatsoever, which reads as a transport that
   * is broken rather than as a sequence that is over.
   */
  it('plays again from the top when the playhead sits at the end', async () => {
    const onTime = vi.fn()
    const { engine } = await playerOver(host, onTime)
    engine.apply({
      ...sequenceWith([trackFixture('V1', 'video', [clipFixture('c', 0, 1_000_000)])]),
      playhead: 1_000_000,
    })
    onTime.mockClear()

    engine.play()
    engine.pause()
    vi.unstubAllGlobals()

    expect(onTime).toHaveBeenCalledWith(0)
  })
})
