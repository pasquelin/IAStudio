import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationClip, type Object3D } from 'three'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import type { ClipRef } from '@shared/domain/scene'
import type { Us } from '@shared/domain/time'
import { clipBlendAt, type ClipWeight } from './clipBlend'
import { skeletonBonesOf, type SkeletonBone } from './rigState'
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
  const lengths: Record<string, number> = {}
  for (const clip of clipsOf(source)) lengths[clip.name] = clip.duration
  return lengths
}

/**
 * Which block runs on real time rather than on the head, when the inspector asked for one.
 *
 * Session state, and that is why it is a pair rather than a flag on the block: playing a clip to
 * look at it is not an edit of the document, and one on a block would put an undo entry behind a
 * play button — which `setPlayhead` refuses by name for the very same reason.
 */
export type SelfPlay = { nodeId: string; clipId: string }

/** One block of the document, and the clip copy it plays. */
type Bound = {
  ref: ClipRef
  /** The file's own clip this block was cut from, so an unchanged one is not copied again. */
  source: AnimationClip
  /** Whether the copy kept the travel, so a decision that flips rebuilds it. */
  travel: boolean
  clip: AnimationClip
}

type Player = {
  mixer: AnimationMixer
  clips: AnimationClip[]
  /** How long each clip of the file runs, which is what a block's width is derived from. */
  lengths: Record<string, number>
  /** The rig, for the track a clip's travel rides on. Empty for a model carrying no bones. */
  bones: SkeletonBone[]
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
 * The head is the ONLY clock here, save for the one block self-play runs: weights and times come
 * out of `clipBlendAt`, so scrubbing backwards and rendering frame by frame both land on the
 * pose playing forwards would have shown.
 */
export class SceneAnimations {
  private readonly players = new Map<string, Player>()
  private timeline: AnimationTimeline = EMPTY_TIMELINE
  private playhead: Us = 0
  private selfPlay: SelfPlay | null = null

  /**
   * Binds a node to the instance the file produced. The clips come from the cached source rather
   * than the clone: `Object3D.copy` does not carry them, and a clip addresses its targets by
   * name, so the source's clips drive any instance built from it.
   */
  add(nodeId: string, root: Object3D, clips: AnimationClip[]): void {
    if (clips.length === 0) return

    this.remove(nodeId)
    const lengths: Record<string, number> = {}
    for (const clip of clips) lengths[clip.name] = clip.duration

    this.players.set(nodeId, {
      mixer: new AnimationMixer(root),
      clips,
      lengths,
      bones: skeletonBonesOf(root),
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
    return this.players.get(nodeId)?.clips ?? []
  }

  /**
   * What the band drives, which is what an `auto` block yields to.
   *
   * Held here rather than passed at each call: keying a trajectory changes no model node at all,
   * so nothing else would tell these blocks to stop travelling on their own.
   */
  setTimeline(timeline: AnimationTimeline): void {
    if (timeline === this.timeline) return

    this.timeline = timeline
    for (const [nodeId, player] of this.players) this.apply(nodeId, refsOf(player))
  }

  /** The one block a play button is holding, or nothing at all — see `SelfPlay`. */
  setSelfPlay(selfPlay: SelfPlay | null): void {
    if (selfPlay?.nodeId === this.selfPlay?.nodeId && selfPlay?.clipId === this.selfPlay?.clipId) {
      return
    }

    this.selfPlay = selfPlay
    this.placeAll()
  }

  /**
   * Makes a node play the blocks the document holds. An empty list puts the model back to its
   * rest pose: with no action left driving them, three restores the values the file was loaded
   * with.
   */
  apply(nodeId: string, refs: readonly ClipRef[]): void {
    const player = this.players.get(nodeId)
    if (!player) return

    const onBand = nodeTravelsOnBand(this.timeline, nodeId)
    const kept = new Set<string>()

    for (const ref of refs) {
      const source = player.clips.find(candidate => candidate.name === ref.source.name)
      // A block naming a clip the file no longer spells plays nothing, rather than costing the
      // whole model its animation.
      if (!source) continue

      kept.add(ref.id)
      const travel = travelsWith(ref.rootMotion, onBand)
      const held = player.bound.get(ref.id)
      // The copy is what costs, so it is remade only when what it holds would differ; a speed or
      // a fade is written onto the action further down without rebuilding anything.
      if (held && held.source === source && held.travel === travel) {
        held.ref = ref
        continue
      }

      if (held) player.mixer.uncacheClip(held.clip)
      const clip = blockClip(source, rootTrackOf(source, player.bones), travel)
      player.bound.set(ref.id, { ref, source, travel, clip })
    }

    for (const [id, held] of player.bound) {
      if (kept.has(id)) continue

      player.mixer.uncacheClip(held.clip)
      player.bound.delete(id)
    }

    this.place(nodeId, player)
  }

  /**
   * Advances the one block a play button is holding, and answers whether anything moved — which
   * is what keeps the viewport's frame loop awake, and lets it fall asleep when nothing does.
   *
   * Everything else stands wherever the head put it: a mixer running against the wall clock is
   * what made two monitors of one scene show two different frames of the same instant.
   */
  update(delta: number): boolean {
    const running = this.selfPlay
    const player = running ? this.players.get(running.nodeId) : null
    const held = running && player ? player.bound.get(running.clipId) : null
    if (!player || !held) return false

    player.mixer.update(delta)
    // A clip that does not loop holds its last pose once it is over, and nothing moving is a
    // frame loop with no reason to stay awake.
    return !player.mixer.clipAction(held.clip).paused
  }

  /**
   * Puts every block where the scene's HEAD says, rather than where real time left it.
   *
   * This is what makes a clip a block on the band: outside its own span a block holds its edge
   * pose, and a render — which never advances real time at all — walks the clip frame by frame
   * instead of writing the same pose a thousand times. A film of a walking character came out
   * frozen for exactly that reason.
   */
  seek(playhead: Us): void {
    this.playhead = playhead
    this.placeAll()
  }

  private placeAll(): void {
    for (const [nodeId, player] of this.players) this.place(nodeId, player)
  }

  private place(nodeId: string, player: Player): void {
    const running = this.selfPlay?.nodeId === nodeId ? this.selfPlay.clipId : null
    const sounding = new Map<string, ClipWeight>()
    if (!running) {
      for (const heard of clipBlendAt(refsOf(player), player.lengths, this.playhead)) {
        sounding.set(heard.clipId, heard)
      }
    }

    for (const [id, held] of player.bound) {
      const action = player.mixer.clipAction(held.clip)
      action.loop = held.ref.loop ? LoopRepeat : LoopOnce
      // Without it a clip played once snaps back to its first frame the instant it ends, which
      // reads as the model teleporting rather than as an animation finishing.
      action.clampWhenFinished = !held.ref.loop
      action.timeScale = held.ref.speed
      action.play()

      if (running) {
        action.enabled = id === running
        action.paused = id !== running
        action.weight = id === running ? 1 : 0
        continue
      }

      // Paused, every one of them: the head is the only clock in this mode, and the time below
      // is written straight in rather than reached by letting the mixer run to it.
      const heard = sounding.get(id)
      action.paused = true
      action.enabled = heard !== undefined
      action.weight = heard?.weight ?? 0
      if (heard) action.time = heard.time
    }

    // A seek has to show without waiting for a frame, and a paused player never gets one.
    player.mixer.update(0)
  }
}

function refsOf(player: Player): ClipRef[] {
  return [...player.bound.values()].map(held => held.ref)
}
