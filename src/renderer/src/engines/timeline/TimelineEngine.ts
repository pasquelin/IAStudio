import { Application, Container, Graphics, Sprite, Texture, type TextureSource } from 'pixi.js'
import { createClock, type Clock } from './clock'
import { createDecoderPool, type DecoderPool, type SinkLike } from './decoder-pool'
import { playbackToken } from './playback'
import {
  clipEnd,
  EMPTY_SEQUENCE,
  playsThrough,
  sequenceDuration,
  type Clip,
  type SequenceState,
  type Track,
  type Us,
} from './timeline-state'

/** The clip a track is playing at that instant, or nothing — a gap is a legitimate answer. */
export function clipAt(track: Track, time: Us): Clip | null {
  return track.clips.find(clip => time >= clip.start && time < clipEnd(clip)) ?? null
}

/** Timeline time → time inside the source, through the in point and the speed. */
export function sourceTimeAt(clip: Clip, time: Us): Us {
  return clip.inPoint + Math.round((time - clip.start) * clip.speed)
}

/** Lowest index first: the sprite added last is the one the eye sees on top. */
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

export type Size = { width: number; height: number }

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

/**
 * The sequence canvas, behind every layer. Black rather than the window's grey: it is the
 * reference the eye judges the picture against, and the bars around a mismatched clip are part
 * of the frame, not part of the chrome.
 */
const CANVAS_COLOUR = 0x000000

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
  maxDecoders: number
  /** Identifies this player to the single playback token — the document id does. */
  owner: string
  /** Called on every played frame, so the document can follow with its playhead. */
  onTime?: (time: Us) => void
  /** `AudioContext.currentTime` while audio plays; absent falls back to the monotonic clock. */
  audioTime?: () => number | null
  /** Fires on both sides of a transport change, including a pause forced by the token. */
  onPlayingChange?: (playing: boolean) => void
}

/**
 * Reads the sequence and paints the frame under the playhead. Holds no React, and rebuilds
 * itself from the state alone — a WebGL context does not survive a move between documents.
 */
export class TimelineEngine {
  private application: Application | null = null
  /** The sequence canvas: laid out once against the screen, so layers stay registered to it. */
  private readonly frame = new Container()
  private readonly backdrop = new Graphics()
  private readonly sprites = new Map<string, Sprite>()
  private readonly pool: DecoderPool
  private state: SequenceState = EMPTY_SEQUENCE
  /** Guards against two seeks interleaving their awaits and painting out of order. */
  private generation = 0

  private readonly clock: Clock
  private frameHandle: number | null = null

  constructor(private readonly deps: TimelineEngineDeps) {
    // First child, so every layer added later composites over it.
    this.frame.addChild(this.backdrop)
    this.pool = createDecoderPool({ open: deps.openSink, maxDecoders: deps.maxDecoders })
    this.clock = createClock({
      audioTime: deps.audioTime ?? (() => null),
      monotonic: () => performance.now(),
    })
  }

  play(): void {
    if (this.frameHandle !== null) return

    // Taking the token revokes whoever held it: two streams at once is the bug this prevents.
    playbackToken.acquire(this.deps.owner, () => this.pause())
    this.clock.start(this.state.playhead)

    const step = (): void => {
      const time = this.clock.now()
      if (time >= sequenceDuration(this.state)) {
        this.pause()
        return
      }

      this.deps.onTime?.(time)
      void this.seek(time)
      this.frameHandle = requestAnimationFrame(step)
    }

    this.frameHandle = requestAnimationFrame(step)
    this.deps.onPlayingChange?.(true)
  }

  pause(): void {
    if (this.frameHandle === null) return

    cancelAnimationFrame(this.frameHandle)
    this.frameHandle = null
    this.clock.stop()
    playbackToken.release(this.deps.owner)
    this.deps.onTime?.(this.clock.now())
    this.deps.onPlayingChange?.(false)
  }

  playing(): boolean {
    return this.frameHandle !== null
  }

  async mount(element: HTMLElement): Promise<void> {
    const application = new Application()
    await application.init({ resizeTo: element, preference: 'webgl', backgroundAlpha: 0 })

    // A mount cancelled while `init` was awaiting must not leave a canvas behind.
    if (!element.isConnected) {
      application.destroy(true, { children: true, texture: true })
      return
    }

    element.appendChild(application.canvas)
    application.stage.addChild(this.frame)
    // The panel resizes without the window doing so, and a frame laid out once would drift.
    application.renderer.on('resize', this.layout)

    this.application = application
    this.layout()
  }

  apply(state: SequenceState): void {
    this.state = state
    this.layout()
    // While playing, the frame loop owns the playhead; seeking here too would fight it.
    if (!this.playing()) void this.seek(state.playhead)
  }

  async seek(time: Us): Promise<void> {
    const application = this.application
    if (!application) return

    this.generation += 1
    const generation = this.generation

    for (const track of videoTracksByDepth(this.state)) {
      const sprite = this.spriteFor(track.id)
      // Asked here rather than by filtering the list: a track dropped from it would keep the
      // sprite it last painted on screen, which is the opposite of muting it.
      const clip = playsThrough(this.state, track) ? clipAt(track, time) : null
      if (!clip) {
        sprite.visible = false
        continue
      }

      const frame = await this.pool.frameAt(clip.assetId, sourceTimeAt(clip, time))
      if (generation !== this.generation) {
        frame?.close()
        return
      }
      if (!frame) {
        sprite.visible = false
        continue
      }

      sprite.visible = true
      createFrameSink({
        upload: uploaded =>
          swapTexture(sprite, uploadNow(Texture.from(uploaded), application.renderer.texture)),
      }).push(frame)
      // After the swap: the placement is read off the texture that just landed.
      place(sprite, fitInside(sprite.texture, this.canvas()))
    }
  }

  openDecoders(): number {
    return this.pool.openCount()
  }

  dispose(): void {
    this.pause()
    this.generation += 1
    this.pool.dispose()
    this.application?.renderer.off('resize', this.layout)
    this.application?.destroy(true, { children: true, texture: true })
    this.application = null
    this.sprites.clear()
  }

  /** The sequence canvas, in its own pixels — what every layer is composited against. */
  private canvas(): Size {
    return { width: this.state.settings.width, height: this.state.settings.height }
  }

  /** Bound rather than a method: the renderer holds it as a listener across the engine's life. */
  private readonly layout = (): void => {
    const application = this.application
    if (!application) return

    const canvas = this.canvas()
    this.backdrop.clear().rect(0, 0, canvas.width, canvas.height).fill(CANVAS_COLOUR)
    place(this.frame, fitInside(canvas, application.screen))
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
