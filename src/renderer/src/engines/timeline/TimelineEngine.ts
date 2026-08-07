import { Application, Sprite, Texture } from 'pixi.js'
import { createDecoderPool, type DecoderPool, type SinkLike } from './decoder-pool'
import {
  clipEnd,
  EMPTY_SEQUENCE,
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

  constructor(deps: TimelineEngineDeps) {
    this.pool = createDecoderPool({ open: deps.openSink, maxDecoders: deps.maxDecoders })
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
    void this.seek(state.playhead)
  }

  async seek(time: Us): Promise<void> {
    if (!this.application) return

    this.generation += 1
    const generation = this.generation

    for (const track of videoTracksByDepth(this.state)) {
      const sprite = this.spriteFor(track.id)
      const clip = clipAt(track, time)
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
