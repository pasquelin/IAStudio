import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationClip, type Object3D } from 'three'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import type { ClipRef } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import { clipBlendAt, type ClipWeight } from './clipBlend'
import { skeletonBonesOf } from './rigState'
import { blockClip, nodeTravelsOnBand, rootTrackOf, travelsWith } from './rootMotion'

/** The clips a loaded file brought, in the order it spells them. */
export function clipsOf(source: Object3D): AnimationClip[] {
  return source.animations
}

export function clipNamesOf(source: Object3D): string[] {
  return clipsOf(source).map(clip => clip.name)
}

/** How long each clip runs, by name — what a block on the band needs to be drawn its own width. */
export function clipLengthsOf(source: Object3D): Record<string, number> {
  return lengthsOf(clipsOf(source))
}

/** One place decides the shape of this record: the band and the mixer must read the same one. */
function lengthsOf(clips: readonly AnimationClip[]): Record<string, number> {
  const lengths: Record<string, number> = {}
  for (const clip of clips) lengths[clip.name] = clip.duration
  return lengths
}

/** One block of the document, and the clip object it plays. */
type Bound = {
  ref: ClipRef
  /** Whether that object kept the travel, so a decision that flips rebuilds it. */
  travel: boolean
  clip: AnimationClip
}

type Player = {
  mixer: AnimationMixer
  /**
   * The file's clips, by name. FIRST WINS on a name held twice, and so does `lengths`: a Mixamo
   * export calls every clip `mixamo.com`, and two answers here would play one clip at another's
   * width.
   */
  clips: Map<string, AnimationClip>
  /** How long each clip of the file runs, which is what a block's width is derived from. */
  lengths: Record<string, number>
  /** The travel channel of each clip, worked out once — it depends on the file and the rig alone. */
  rootTracks: Map<string, string | null>
  /** One entry per block the document holds, keyed by block id. */
  bound: Map<string, Bound>
}

/**
 * The animation clips of every model in the scene, driven from what the document says.
 *
 * A registry apart from the nodes, on `bvh-inflight`'s pattern: a mixer is a live three object
 * bound to one instance, while a document holds a clip name and four numbers. Keeping the two
 * apart is what lets a viewport be thrown away and rebuilt in another window — and it is what
 * makes any of this testable, since a mixer needs no GPU at all.
 *
 * The head is the ONLY clock here: nothing in this class advances on real time, weights and times
 * come out of `clipBlendAt`, and scrubbing backwards or rendering frame by frame both land on the
 * pose playing forwards would have shown.
 */
export class SceneAnimations {
  private readonly players = new Map<string, Player>()
  private timeline: AnimationTimeline = EMPTY_TIMELINE
  private playhead: Us = 0

  /**
   * Binds a node to the instance the file produced. The clips come from the cached SOURCE rather
   * than the clone: `Object3D.copy` does not carry them, and a clip addresses its targets by name.
   */
  add(nodeId: string, root: Object3D, clips: AnimationClip[]): void {
    if (clips.length === 0) return

    this.remove(nodeId)
    const bones = skeletonBonesOf(root)
    const byName = new Map<string, AnimationClip>()
    const rootTracks = new Map<string, string | null>()
    for (const clip of clips) {
      if (byName.has(clip.name)) continue

      byName.set(clip.name, clip)
      rootTracks.set(clip.name, rootTrackOf(clip, bones))
    }

    this.players.set(nodeId, {
      mixer: new AnimationMixer(root),
      clips: byName,
      lengths: lengthsOf([...byName.values()]),
      rootTracks,
      bound: new Map(),
    })
  }

  remove(nodeId: string): void {
    const player = this.players.get(nodeId)
    if (!player) return

    // Both, and in this order: `stopAllAction` leaves the actions cached, and a mixer holding
    // them keeps every bone of a released model alive with it.
    player.mixer.stopAllAction()
    player.mixer.uncacheRoot(player.mixer.getRoot())
    this.players.delete(nodeId)
  }

  clear(): void {
    for (const nodeId of [...this.players.keys()]) this.remove(nodeId)
  }

  has(nodeId: string): boolean {
    return this.players.has(nodeId)
  }

  /** What a node's file brought, for whoever has to say again what that model IS. */
  clipsOf(nodeId: string): AnimationClip[] {
    return [...(this.players.get(nodeId)?.clips.values() ?? [])]
  }

  /**
   * What the band drives, which is what an `auto` block yields to. Held here rather than passed
   * at each call: keying a trajectory changes no model node, so nothing else would tell these
   * blocks to stop travelling on their own.
   */
  setTimeline(timeline: AnimationTimeline): void {
    if (timeline === this.timeline) return

    this.timeline = timeline
    for (const [nodeId, player] of this.players) this.apply(nodeId, refsOf(player))
  }

  /**
   * Makes a node play the blocks the document holds. An empty list puts the model back to its rest
   * pose: with no action driving them, three restores the values the file was loaded with.
   */
  apply(nodeId: string, refs: readonly ClipRef[]): void {
    const player = this.players.get(nodeId)
    if (!player) return

    const onBand = nodeTravelsOnBand(this.timeline, nodeId)
    const kept = new Set<string>()

    for (const ref of refs) {
      const source = player.clips.get(ref.source.name)
      // A block naming a clip the file no longer spells plays nothing, rather than costing the
      // whole model its animation.
      if (!source) continue

      kept.add(ref.id)
      const travel = travelsWith(ref.rootMotion, onBand)
      const held = player.bound.get(ref.id)
      // Rebuilt only when the travel decision flips; a speed, a fade or a move is written onto
      // the action further down without touching the clip. `player.clips` never changes.
      if (held && held.travel === travel && held.clip.name === ref.source.name) {
        held.ref = ref
        continue
      }

      if (held) player.mixer.uncacheClip(held.clip)
      const clip = blockClip(source, player.rootTracks.get(ref.source.name) ?? null, travel)
      player.bound.set(ref.id, { ref, travel, clip })
    }

    for (const [id, held] of player.bound) {
      if (kept.has(id)) continue

      player.mixer.uncacheClip(held.clip)
      player.bound.delete(id)
    }

    this.place(player)
  }

  /**
   * Puts every block where the scene's HEAD says, rather than where real time left it. A render
   * never advances real time at all: without this it writes the same pose a thousand times, and
   * a film of a walking character came out frozen for exactly that reason.
   */
  seek(playhead: Us): void {
    this.playhead = playhead
    this.placeAll()
  }

  private placeAll(): void {
    for (const player of this.players.values()) this.place(player)
  }

  private place(player: Player): void {
    const sounding = new Map<string, ClipWeight>()
    for (const heard of clipBlendAt(refsOf(player), player.lengths, this.playhead)) {
      sounding.set(heard.clipId, heard)
    }

    for (const [id, held] of player.bound) {
      const action = player.mixer.clipAction(held.clip)
      action.loop = held.ref.loop ? LoopRepeat : LoopOnce
      action.play()

      // Paused, every one of them: the head is the only clock, and the time below is written
      // straight in rather than reached by letting the mixer run to it.
      const heard = sounding.get(id)
      action.paused = true
      action.enabled = heard !== undefined
      action.weight = heard?.weight ?? 0
      if (heard) action.time = heard.time
    }

    // A pose has to show without waiting for a frame, and nothing here ever gets one.
    player.mixer.update(0)
  }
}

function refsOf(player: Player): ClipRef[] {
  return [...player.bound.values()].map(held => held.ref)
}
