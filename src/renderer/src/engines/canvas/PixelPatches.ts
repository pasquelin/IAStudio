import { Container, Graphics, Rectangle, RenderTexture, Sprite, Texture } from 'pixi.js'
import type { Rect } from './canvas-state'
import { tileBytes, tileKey, tilesCovering, type Tile } from './tiles'
import type { Size } from './viewport'

/** Which end of a gesture a patch is being replayed towards. */
export type PatchSide = 'before' | 'after'

/**
 * Only the one call the store makes on the renderer, so a test can hand it a recorder — the same
 * reason `OverlayContext` names the handful of 2D members the overlay touches.
 */
export type PatchRenderer = {
  render: (options: { container: Container; target: RenderTexture; clear: boolean }) => void
}

/** One tile of one patch, photographed either side of the gesture that dirtied it. */
type Capture = { tile: Tile; before: RenderTexture; after: RenderTexture | null }

type Patch = { id: string; surfaceId: string; captures: Capture[]; bytes: number }

type Recording = {
  id: string
  surfaceId: string
  source: RenderTexture
  document: Size
  captured: Map<string, Capture>
}

/** What a set of captures costs, once per photograph taken of them. */
function weightOf(captures: Iterable<Capture>): number {
  let bytes = 0
  for (const capture of captures) bytes += tileBytes(capture.tile)
  return bytes
}

/**
 * How much GPU memory the undo tiles may hold. Two textures per touched tile — the state before
 * the gesture and the state after — so this is roughly a hundred and twenty full tiles.
 */
export const PATCH_BUDGET = 256 * 1024 * 1024

/**
 * The pixels an undo needs, kept as tiles rather than as whole layers. It belongs to the engine
 * and never to a command: a command is data in a history that outlives any GPU context, and a
 * texture is not.
 *
 * The store is bounded. Past the budget the oldest patches are destroyed, and their ids are
 * reported — an entry whose pixels are gone has to leave the history rather than sit in it
 * pretending it can still be undone.
 */
export class PixelPatches {
  /** Insertion order is age order, which is the order they are thrown away in. */
  private readonly patches = new Map<string, Patch>()
  private recording: Recording | null = null
  private bytes = 0

  constructor(
    private readonly renderer: PatchRenderer,
    private readonly onDropped: (patchId: string) => void,
    private readonly budget: number = PATCH_BUDGET,
  ) {}

  /** Opens a recording. Whatever was open is thrown away: only one gesture writes at a time. */
  begin(id: string, surfaceId: string, source: RenderTexture, document: Size): void {
    this.cancel()
    this.recording = { id, surfaceId, source, document, captured: new Map() }
  }

  get recordingId(): string | null {
    return this.recording?.id ?? null
  }

  /**
   * Called BEFORE the pixels of `rect` are written to. The first time a tile is dirtied its
   * previous state is copied aside; afterwards it costs a lookup, which is what makes a stroke of
   * a thousand dabs cost as much as one.
   */
  touch(rect: Rect): void {
    const recording = this.recording
    if (!recording) return

    for (const tile of tilesCovering(rect, recording.document)) {
      const key = tileKey(tile)
      if (recording.captured.has(key)) continue

      recording.captured.set(key, {
        tile,
        before: this.copyOut(tile, recording.source),
        after: null,
      })
    }
    this.evict()
  }

  /**
   * Closes the recording and photographs the tiles again. Returns the patch id, or `null` when
   * the gesture touched nothing — an armed brush released without a drag leaves no entry.
   */
  end(): string | null {
    const recording = this.recording
    this.recording = null
    if (!recording || recording.captured.size === 0) return null

    const captures = [...recording.captured.values()]
    for (const capture of captures) {
      capture.after = this.copyOut(capture.tile, recording.source)
    }

    const bytes = weightOf(captures) * 2
    this.patches.set(recording.id, {
      id: recording.id,
      surfaceId: recording.surfaceId,
      captures,
      bytes,
    })
    this.bytes += bytes
    this.evict()
    return recording.id
  }

  /**
   * Which surface a patch belongs to, so the engine can find the texture to paint it back into.
   * A surface is a layer's pixels or its mask: the store never needs to know which.
   */
  surfaceOf(patchId: string): string | null {
    return this.patches.get(patchId)?.surfaceId ?? null
  }

  /** `false` when the patch has been thrown away — the caller must not pretend it succeeded. */
  restore(patchId: string, side: PatchSide, target: RenderTexture): boolean {
    const patch = this.patches.get(patchId)
    if (!patch) return false

    for (const capture of patch.captures) {
      const texture = side === 'before' ? capture.before : capture.after
      if (texture) this.copyIn(texture, capture.tile, target)
    }
    return true
  }

  /**
   * Throws every patch away and reports each one, the way the budget does. Called when the
   * surfaces are rebuilt at another size: a capture names its tile in the surface's own
   * coordinates, and once that surface is a different shape those coordinates designate
   * somewhere else — replaying one would paint the right pixels in the wrong place.
   *
   * A history that stops reads as a limit; a ⌘Z that moves pixels sideways reads as a bug.
   */
  dropAll(): void {
    this.cancel()
    for (const [id, patch] of this.patches) {
      this.destroyPatch(patch)
      this.patches.delete(id)
      this.bytes -= patch.bytes
      this.onDropped(id)
    }
  }

  dispose(): void {
    this.cancel()
    for (const patch of this.patches.values()) this.destroyPatch(patch)
    this.patches.clear()
    this.bytes = 0
  }

  private cancel(): void {
    const recording = this.recording
    this.recording = null
    if (!recording) return
    for (const capture of recording.captured.values()) capture.before.destroy(true)
  }

  /** A tile of the surface, lifted into a texture of its own. */
  private copyOut(tile: Tile, source: RenderTexture): RenderTexture {
    const texture = RenderTexture.create({
      width: tile.width,
      height: tile.height,
      resolution: 1,
    })
    const frame = new Texture({
      source: source.source,
      frame: new Rectangle(tile.x, tile.y, tile.width, tile.height),
    })
    const sprite = new Sprite(frame)
    this.renderer.render({ container: sprite, target: texture, clear: true })
    // The frame is a window onto the layer's own source, which must outlive it.
    sprite.destroy({ texture: true, textureSource: false })
    return texture
  }

  /**
   * A tile painted back over the surface. `erase` first, then the tile: compositing it on top would
   * blend the old stroke with the new one instead of replacing what is there.
   */
  private copyIn(source: RenderTexture, tile: Tile, target: RenderTexture): void {
    const hole = new Graphics()
    hole.rect(tile.x, tile.y, tile.width, tile.height)
    hole.fill({ color: 0xffffff })
    hole.blendMode = 'erase'

    const sprite = new Sprite(source)
    sprite.position.set(tile.x, tile.y)

    const container = new Container()
    container.addChild(hole)
    container.addChild(sprite)
    this.renderer.render({ container, target, clear: false })
    // Children only: the tile texture is the store's, and is replayed again on every redo.
    container.destroy({ children: true })
  }

  /** Oldest first, and never the one being recorded: a gesture in flight has nothing to undo to. */
  private evict(): void {
    const inFlight = this.recording ? weightOf(this.recording.captured.values()) : 0

    for (const [id, patch] of this.patches) {
      if (this.bytes + inFlight <= this.budget) return

      this.destroyPatch(patch)
      this.patches.delete(id)
      this.bytes -= patch.bytes
      this.onDropped(id)
    }
  }

  private destroyPatch(patch: Patch): void {
    for (const capture of patch.captures) {
      capture.before.destroy(true)
      capture.after?.destroy(true)
    }
  }
}
