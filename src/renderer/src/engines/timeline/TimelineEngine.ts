import { Container, Graphics, Sprite, Texture, type Application, type TextureSource } from 'pixi.js'
import { bytesFromBase64 } from '@/helpers/base64'
import { createClock, type Clock } from './clock'
import { createDecoderPool, type DecoderPool, type SinkLike } from './decoderPool'
import { playbackToken } from './playback'
import {
  createSoundScheduler,
  SOUND_HORIZON,
  type SoundPort,
  type SoundScheduler,
} from './soundSchedule'
import {
  clipEnd,
  clipSource,
  EMPTY_SEQUENCE,
  playsThrough,
  sequenceDuration,
  sourceTimeAt,
  type Clip,
  type SequenceState,
  type Track,
  type Us,
} from './timelineState'
import { followHostSize, mountApplication } from '../core/mount'
import { tokenAsHex } from '../core/palette'
import type { Size } from '../core/geometry'

/** The clip a track is playing at that instant, or nothing — a gap is a legitimate answer. */
export function clipAt(track: Track, time: Us): Clip | null {
  return track.clips.find(clip => time >= clip.start && time < clipEnd(clip)) ?? null
}

/** A still already on this sprite: skip the decode and the GPU upload. */
export function reusePaintedSource(
  source: string | null,
  trackId: string,
  stable: (assetId: string) => boolean,
  painted: ReadonlyMap<string, string>,
): boolean {
  return source !== null && stable(source) && painted.get(trackId) === source
}

/**
 * The sprites whose track LEFT the frame, and which nothing else would ever take down.
 *
 * The paint loop reaches only the tracks still in the list, so a track deleted — or turned into a
 * sound track by a change of selection — would keep the image it last painted on screen while
 * something else plays.
 */
export function spritesOffFrame<T>(
  sprites: ReadonlyMap<string, T>,
  painting: readonly Track[],
): T[] {
  const inFrame = new Set(painting.map(track => track.id))
  return [...sprites].filter(([trackId]) => !inFrame.has(trackId)).map(([, sprite]) => sprite)
}

/** Under every track: the depths handed to the sprites start at zero — see `seek`. */
const BACKDROP_DEPTH = -1

/**
 * Lowest index first, which is the order the sprites are given their depths in: the LAST of this
 * list is the row highest in the column, and the one the eye sees on top.
 */
export function videoTracksByDepth(state: SequenceState): Track[] {
  return state.tracks
    .filter(track => track.kind === 'video')
    .sort((left, right) => left.index - right.index)
}

/**
 * Swaps a decoded frame in and disposes of the texture it replaces — never `Texture.EMPTY`,
 * which every sprite starts on and the whole application shares. Pixi 8 happens to no-op its
 * `destroy`, but destroying what one did not create is not something to lean on a library for.
 */
export function swapTexture(target: { texture: Texture }, next: Texture): void {
  const previous = target.texture
  target.texture = next
  if (previous !== Texture.EMPTY) previous.destroy(true)
}

/** Where something sized lands once fitted: its top-left corner, and the factor to draw it by. */
export type Placement = { x: number; y: number; scale: number }

/**
 * Letterboxes `source` inside `frame`, centred, aspect ratio kept. A scale rather than a width
 * and a height: stretching a 4:3 rush to fill a 16:9 sequence is the one thing a monitor judging
 * a picture must never do. Anything unmeasured yields a zero scale — never a NaN on the stage.
 */
export function fitInside(source: Size, frame: Size): Placement {
  const usable = source.width > 0 && source.height > 0 && frame.width > 0 && frame.height > 0
  if (!usable) return { x: 0, y: 0, scale: 0 }

  const scale = Math.min(frame.width / source.width, frame.height / source.height)
  return {
    x: (frame.width - source.width * scale) / 2,
    y: (frame.height - source.height * scale) / 2,
    scale,
  }
}

/** Applies a placement to anything Pixi positions and scales. */
function place(target: Container, placement: Placement): void {
  target.position.set(placement.x, placement.y)
  target.scale.set(placement.scale)
}

/** The sequence canvas, behind every layer — see `--color-monitor`. */
const CANVAS_TOKEN = '--color-monitor'
const CANVAS_FALLBACK = 0x000000

/** What a renderer must offer to take a frame now rather than at its next pass. */
export type TextureUploader = { initSource: (source: TextureSource) => void }

/**
 * Puts a texture on the GPU now, and hands it back. Pixi uploads a source at its next render —
 * by which time the sink has closed the frame behind it, and the monitor paints nothing at all.
 */
export function uploadNow(texture: Texture, uploader: TextureUploader): Texture {
  uploader.initSource(texture.source)
  return texture
}

export type FrameSink = { push: (frame: VideoFrame) => void }

/** Uploads then closes, always in that order and always both. */
export function createFrameSink({ upload }: { upload: (frame: VideoFrame) => void }): FrameSink {
  return {
    push: frame => {
      try {
        upload(frame)
      } finally {
        frame.close()
      }
    },
  }
}

export type TimelineEngineDeps = {
  openSink: (assetId: string) => Promise<SinkLike>
  /**
   * Where the sound goes. Required rather than optional: a player silent because a dependency
   * was forgotten says nothing about it, and this repository has paid that once already.
   */
  sound: SoundPort
  maxDecoders: number
  /** Still pictures hold no decoder; their ceiling bounds memory, not silicon. */
  maxPictures: number
  /** Identifies this player to the single playback token — the document id does. */
  owner: string
  /** Called on every played frame, so the document can follow with its playhead. */
  onTime?: (time: Us) => void
  /** `AudioContext.currentTime` while audio plays; absent falls back to the monotonic clock. */
  audioTime?: () => number | null
  /** Fires on both sides of a transport change, including a pause forced by the token. */
  onPlayingChange?: (playing: boolean) => void
  /**
   * Whether the frame just painted left a clip unshown because its media could not be read.
   *
   * `unreadable` rather than the pool's `undecodable`, and the difference is the point: the pool
   * states a mechanical fact — this open failed, it will not be retried — where a failed fetch
   * for a moved file counts as much as a format Chromium refuses. What reaches the screen can
   * only claim the second.
   *
   * Reported on every seek rather than once per asset: the answer belongs to the playhead, and
   * a message raised where a `.exr` sits has to fall again on the clip that follows it.
   */
  onUnreadable?: (unreadable: boolean) => void
}

/**
 * Reads the sequence and paints the frame under the playhead. Holds no React, and rebuilds
 * itself from the state alone — a WebGL context does not survive a move between documents.
 */
export class TimelineEngine {
  private application: Application | null = null
  /**
   * The sequence canvas: laid out once against the screen, so layers stay registered to it.
   *
   * Sorted, because the order children were ADDED in says nothing about which track is on top:
   * a sprite joins the frame the first time its track paints. Every seek restates the depths.
   */
  private readonly frame = new Container({ sortableChildren: true })
  private readonly backdrop = new Graphics()
  private readonly sprites = new Map<string, Sprite>()
  /** Last source uploaded per track — stills skip the next seek when this still matches. */
  private readonly painted = new Map<string, string>()
  private readonly pool: DecoderPool
  private state: SequenceState = EMPTY_SEQUENCE
  /** Guards against two seeks interleaving their awaits and painting out of order. */
  private generation = 0
  /** Set for good by `dispose`. A mount that resolves afterwards has nowhere left to attach. */
  private disposed = false
  /** The canvas and screen sizes the frame was last laid out for — see `layout`. */
  private laidOut = ''
  /** Stops watching the panel this monitor sits in — see `followHostSize`. */
  private unfollow: (() => void) | null = null

  private readonly clock: Clock
  private readonly sound: SoundScheduler
  private frameHandle: number | null = null
  /**
   * Whether the transport is running — which is NOT « a frame is pending ».
   *
   * The loop spends most of its time inside a decode with no frame requested, and reading the
   * handle as the transport's state made `pause` a no-op exactly there.
   */
  private running = false
  /** Which run of the transport a frame belongs to — see `step`. */
  private transport = 0

  constructor(private readonly deps: TimelineEngineDeps) {
    // Below every track, and said as a depth rather than left to the order it was added in:
    // the frame sorts its children, and a sprite of depth 0 would otherwise tie with it.
    this.backdrop.zIndex = BACKDROP_DEPTH
    this.frame.addChild(this.backdrop)
    this.sound = createSoundScheduler({ port: deps.sound, horizon: SOUND_HORIZON })
    this.pool = createDecoderPool({
      open: deps.openSink,
      maxDecoders: deps.maxDecoders,
      maxPictures: deps.maxPictures,
    })
    this.clock = createClock({
      audioTime: deps.audioTime ?? (() => null),
      monotonic: () => performance.now(),
    })
  }

  play(): void {
    if (this.running) return

    // Taking the token revokes whoever held it: two streams at once is the bug this prevents.
    playbackToken.acquire(this.deps.owner, () => this.pause())

    // The playhead stops ON the end, where the loop's first test sends it straight back to
    // pause: pressing play there did nothing at all, which reads as a broken transport rather
    // than as a sequence that is over.
    const from = this.state.playhead >= sequenceDuration(this.state) ? 0 : this.state.playhead
    if (from !== this.state.playhead) this.deps.onTime?.(from)

    // Sound first: it wakes the output, and the clock asks that same output whether to follow it
    // — asked before, the answer is always no and the sequence runs on the wall clock instead.
    this.sound.start(from)
    this.clock.start(from)

    this.running = true
    this.transport += 1
    this.nextFrame(this.transport)
    this.deps.onPlayingChange?.(true)
  }

  pause(): void {
    if (!this.running) return

    this.running = false
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle)
    this.frameHandle = null
    this.clock.stop()
    this.sound.stop()
    playbackToken.release(this.deps.owner)
    this.deps.onTime?.(this.clock.now())
    this.deps.onPlayingChange?.(false)
  }

  playing(): boolean {
    return this.running
  }

  /**
   * One decode in flight at a time, and the next frame asked for only once it has been painted.
   *
   * Asked every animation frame instead, the loop outran its own decoder: `seek` bumps the
   * generation on entry, so each ask invalidated the one still awaiting a frame, and a decode
   * that took longer than sixteen milliseconds — which is every hardware decode — was closed
   * unpainted on return. The picture froze at the first miss and only a pause revived it.
   *
   * The playhead comes from the clock rather than from a frame count, so a decoder slower than
   * real time drops pictures instead of falling behind the sound.
   */
  private nextFrame(transport: number): void {
    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null
      void this.step(transport)
    })
  }

  /**
   * `transport` says which run this frame belongs to, and `running` alone cannot.
   *
   * Most of a frame is spent inside a decode, with no animation frame left for `pause` to
   * cancel: pausing there and pressing play again started a second chain while the first was
   * still in flight, and the two then invalidated each other's decodes on every frame — the
   * very freeze this loop was rewritten to fix.
   */
  private async step(transport: number): Promise<void> {
    if (!this.running || transport !== this.transport) return

    const time = this.clock.now()
    if (time >= sequenceDuration(this.state)) {
      this.pause()
      return
    }

    this.deps.onTime?.(time)
    // Planned from the frame loop rather than from `seek`: a seek also happens while paused,
    // where scrubbing must stay silent, and it happens per video track rather than per frame.
    this.sound.pump(time)
    await this.seek(time)
    // Re-read: a pause, a revoked token or a dispose may all have landed during that decode.
    if (this.running && transport === this.transport) this.nextFrame(transport)
  }

  async mount(element: HTMLElement): Promise<void> {
    const application = await mountApplication(
      {
        resizeTo: element,
        preference: 'webgl',
        backgroundAlpha: 0,
        // A paused sequence holds one still frame: every change calls `draw`. Left on, Pixi would
        // redraw that frame sixty times a second, even for a tab Dockview keeps mounted behind.
        autoStart: false,
      },
      () => this.disposed || !element.isConnected,
    )
    if (!application) return

    element.appendChild(application.canvas)
    application.stage.addChild(this.frame)
    // The panel resizes without the window doing so, and a frame laid out once would drift.
    // Pixi renders right after emitting this, so laying out is all this listener owes it.
    application.renderer.on('resize', this.layout)
    // What actually makes that resize happen: `resizeTo` alone answers to the window only.
    this.unfollow = followHostSize(application, element)

    this.application = application
    this.layout()
    // Seeks rather than draws: the first `apply` lands while Pixi is still starting, `seek`
    // returns on a missing application, and nothing else asks again — a monitor mounted on a
    // sequence already positioned showed the backdrop and waited for the playhead to move.
    void this.seek(this.state.playhead)
  }

  apply(state: SequenceState): void {
    this.state = state
    this.sound.apply(state)
    this.layout()
    // While playing, the frame loop owns the playhead; seeking here too would fight it.
    if (!this.playing()) void this.seek(state.playhead)
  }

  async seek(time: Us): Promise<void> {
    const application = this.application
    if (!application) return

    this.generation += 1
    const generation = this.generation
    let unreadable = false
    let painted = false

    const painting = videoTracksByDepth(this.state)
    for (const sprite of spritesOffFrame(this.sprites, painting)) sprite.visible = false

    // Every track asked BEFORE any is awaited: each holds a sink of its own, so their decodes
    // are independent, and awaiting them one after another made a frame of a two-track montage
    // cost the sum of two decodes rather than the longer of them.
    const asked = painting.map((track, depth) => {
      // Asked here rather than by filtering the list: a track dropped from it would keep the
      // sprite it last painted on screen, which is the opposite of muting it.
      const clip = playsThrough(this.state, track) ? clipAt(track, time) : null
      const sprite = this.spriteFor(track.id)
      // Restated on EVERY seek, and that is the whole point: a sprite joins the frame the first
      // time its track is painted, so the order the children were added in is the order the
      // tracks first appeared — never the order of the column. V2, opened after V1 already had
      // a sprite, composited OVER it, and a track dragged to another row kept its old depth.
      sprite.zIndex = depth
      const source = clip ? clipSource(clip) : null
      const reuse = reusePaintedSource(source, track.id, this.pool.stable, this.painted)
      return {
        sprite,
        clip,
        source,
        trackId: track.id,
        reuse,
        frame:
          clip && source && !reuse ? this.pool.frameAt(source, sourceTimeAt(clip, time)) : null,
      }
    })

    const decoded = await Promise.all(asked.map(({ frame }) => frame))
    if (generation !== this.generation) {
      for (const frame of decoded) frame?.close()
      return
    }

    asked.forEach(({ sprite, clip, source, trackId, reuse }, index) => {
      if (reuse) {
        sprite.visible = true
        painted = true
        return
      }

      const frame = decoded[index]
      if (!frame) {
        sprite.visible = false
        this.painted.delete(trackId)
        if (clip && this.pool.undecodable(clipSource(clip))) unreadable = true
        return
      }

      sprite.visible = true
      painted = true
      if (source) this.painted.set(trackId, source)
      createFrameSink({
        upload: uploaded =>
          swapTexture(sprite, uploadNow(Texture.from(uploaded), application.renderer.texture)),
      }).push(frame)
      this.fit(sprite)
    })

    // Only when the monitor is showing nothing at all: the message covers the whole picture, and
    // laying it over a track that did decode would trade one silence for a worse lie. A layer
    // lost under one that painted stays silent, and that half is still open.
    this.deps.onUnreadable?.(unreadable && !painted)
    this.draw()
  }

  openSinks(): number {
    return this.pool.openCount()
  }

  dispose(): void {
    this.disposed = true
    this.pause()
    this.generation += 1
    this.pool.dispose()
    this.unfollow?.()
    this.unfollow = null
    this.application?.renderer.off('resize', this.layout)
    this.application?.destroy(true, { children: true, texture: true })
    this.application = null
    this.sprites.clear()
    this.painted.clear()
  }

  /** Pixi's own ticker is off — see `mount`. Every visible change ends here. */
  private draw(): void {
    this.application?.render()
  }

  /**
   * The composited frame as it stands, as PNG bytes — one call per frame of an export.
   *
   * Extracted from the frame container rather than read off the canvas: a WebGL drawing buffer
   * is only guaranteed to hold its pixels until the task ends, and an export awaits between
   * every frame. Pixi renders the container into a texture of its own, which has no such rule.
   *
   * `null` before the application exists, which is the only thing that can go wrong here.
   */
  async snapshot(): Promise<Uint8Array | null> {
    const application = this.application
    if (!application) return null

    const url = await application.renderer.extract.base64({ target: this.frame, format: 'png' })
    return bytesFromBase64(url)
  }

  /** The sequence canvas, in its own pixels — what every layer is composited against. */
  private canvas(): Size {
    return { width: this.state.settings.width, height: this.state.settings.height }
  }

  /**
   * Bound rather than a method: the renderer holds it as a listener across the engine's life.
   *
   * Guarded because `apply` runs it, and `apply` runs on every pointer move of a trim — where
   * re-tessellating the backdrop for a rectangle nobody resized is pure waste.
   */
  private readonly layout = (): void => {
    const application = this.application
    if (!application) return

    const canvas = this.canvas()
    const screen = application.screen
    const shape = `${canvas.width}x${canvas.height}@${screen.width}x${screen.height}`
    if (shape === this.laidOut) return
    this.laidOut = shape

    const colour = tokenAsHex(application.canvas, CANVAS_TOKEN, CANVAS_FALLBACK)
    this.backdrop.clear().rect(0, 0, canvas.width, canvas.height).fill(colour)
    place(this.frame, fitInside(canvas, application.screen))

    for (const sprite of this.sprites.values()) this.fit(sprite)
  }

  /** Letterboxes one layer in the sequence canvas. Only its texture's size can change this. */
  private fit(sprite: Sprite): void {
    place(sprite, fitInside(sprite.texture, this.canvas()))
  }

  private spriteFor(trackId: string): Sprite {
    const existing = this.sprites.get(trackId)
    if (existing) return existing

    const sprite = new Sprite()
    this.sprites.set(trackId, sprite)
    this.frame.addChild(sprite)
    return sprite
  }
}
