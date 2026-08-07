import { Application, Sprite, Texture } from 'pixi.js'
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
  private readonly sprites = new Map<string, Sprite>()
  private readonly pool: DecoderPool
  private state: SequenceState = EMPTY_SEQUENCE
  /** Guards against two seeks interleaving their awaits and painting out of order. */
  private generation = 0

  private readonly clock: Clock
  private frameHandle: number | null = null

  constructor(private readonly deps: TimelineEngineDeps) {
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
    this.application = application
  }

  apply(state: SequenceState): void {
    this.state = state
    // While playing, the frame loop owns the playhead; seeking here too would fight it.
    if (!this.playing()) void this.seek(state.playhead)
  }

  async seek(time: Us): Promise<void> {
    if (!this.application) return

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
        upload: uploaded => {
          const previous = sprite.texture
          sprite.texture = Texture.from(uploaded)
          previous.destroy(true)
        },
      }).push(frame)
    }
  }

  openDecoders(): number {
    return this.pool.openCount()
  }

  dispose(): void {
    this.pause()
    this.generation += 1
    this.pool.dispose()
    this.application?.destroy(true, { children: true, texture: true })
    this.application = null
    this.sprites.clear()
  }

  private spriteFor(trackId: string): Sprite {
    const existing = this.sprites.get(trackId)
    if (existing) return existing

    const sprite = new Sprite()
    this.sprites.set(trackId, sprite)
    this.application?.stage.addChild(sprite)
    return sprite
  }
}
