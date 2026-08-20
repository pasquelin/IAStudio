import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationClip, type Object3D } from 'three'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { clipKeyOf, type ClipLane, type ClipRef, type ClipSource } from '@shared/domain/scene'
import { assetUrl } from '@shared/domain/asset'
import { bundledAnimationUrl } from '@shared/domain/animationLibrary'
import { WHOLE_BODY, type BodyPart } from '@shared/domain/humanoid'
import { bonesDrivenBy } from './boneRoles'
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
  return lengthsOf(clipsOf(source))
}

/** A clip a model's blocks name that its own file did not bring: where to read it, what to call it. */
export type ForeignClip = { key: string; url: string; label: string }

/** Where a clip that did not come with the model is read from — `null` for the model's own. */
export function clipSourceUrl(source: ClipSource): string | null {
  if (source.kind === 'bundled') return bundledAnimationUrl(source.name)
  return source.kind === 'asset' ? assetUrl(source.assetId) : null
}

/**
 * Every clip a document asks a model to play that the model's own file did not bring, once each.
 *
 * Once per KEY and not per block: a walk laid down four times is one file to read, and the key
 * carries the kind, so a shipped `walk` and a project asset called `walk` stay two things.
 */
export function foreignClipsOf(lanes: readonly ClipLane[]): ForeignClip[] {
  const found = new Map<string, ForeignClip>()

  for (const clip of lanes.flatMap(lane => lane.clips)) {
    const url = clipSourceUrl(clip.source)
    const key = clipKeyOf(clip.source)
    if (url && !found.has(key)) found.set(key, { key, url, label: clip.label })
  }
  return [...found.values()]
}

/** The bones a half of this body covers, read once per half — the roles walk every bone. */
function drivenIn(player: Player, part: BodyPart): ReadonlySet<string> | null {
  if (!player.driven.has(part)) player.driven.set(part, bonesDrivenBy(player.bones, part))
  return player.driven.get(part) ?? null
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
  /** Which entry of `clips` it was built from, so a block pointed elsewhere is rebuilt. */
  key: string
  /** Which bones that object was cut down to, so a block given another half is rebuilt too. */
  part: BodyPart
  clip: AnimationClip
}

type Player = {
  mixer: AnimationMixer
  /**
   * Every clip this model can play, by `clipKeyOf` — its file's own, and whatever was retargeted
   * onto it since. FIRST WINS on a key held twice, and so does `lengths`: a Mixamo export calls
   * every clip `mixamo.com`, and two answers here would play one clip at another's width.
   */
  clips: Map<string, AnimationClip>
  /** The names the model's OWN file spells, which is what a panel offers a choice from. */
  fileNames: readonly string[]
  /** The bones the clips play on, kept so a clip arriving later can be read against them. */
  bones: readonly SkeletonBone[]
  /**
   * Which bones each half of this body covers, worked out at most once per half: reading the
   * roles walks all fifty-two, and it depends on the skeleton alone.
   */
  driven: Map<BodyPart, ReadonlySet<string> | null>
  /** How long each clip runs, which is what a block's width is derived from. */
  lengths: Record<string, number>
  /** The travel channel of each clip, worked out once — it depends on the file and the rig alone. */
  rootTracks: Map<string, string | null>
  /** The lanes as the document holds them. `bound` alone would lose which lane a block lies in. */
  lanes: readonly ClipLane[]
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
    // A file bringing NO clip is filed all the same: a bare rigged character is exactly what a
    // shipped animation is dropped onto, and there would be nothing here to hand it to.
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
      fileNames: [...byName.keys()],
      bones,
      driven: new Map(),
      lengths: lengthsOf([...byName.values()]),
      rootTracks,
      lanes: [],
      bound: new Map(),
    })
  }

  /**
   * Files a clip this model did not bring — one shipped with the app, replayed on its skeleton.
   * Blocks naming it play nothing until it lands, so applying again is part of adding it.
   */
  addClip(nodeId: string, key: string, clip: AnimationClip): void {
    const player = this.players.get(nodeId)
    if (!player || player.clips.has(key)) return

    player.clips.set(key, clip)
    player.lengths[key] = clip.duration
    player.rootTracks.set(key, rootTrackOf(clip, player.bones))
    this.apply(nodeId, player.lanes)
  }

  /** How long each clip a node can play runs, by key — what the band draws its blocks from. */
  lengthsOf(nodeId: string): Readonly<Record<string, number>> {
    return this.players.get(nodeId)?.lengths ?? {}
  }

  /** What the model's own file spells, which is the list a panel offers a choice from. */
  fileNamesOf(nodeId: string): readonly string[] {
    return this.players.get(nodeId)?.fileNames ?? []
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
    const player = this.players.get(nodeId)
    if (!player) return []

    // Its OWN, never what was retargeted onto it: a rig describes the file, and an animation
    // dropped on a character says nothing about the character.
    return player.fileNames.flatMap(name => player.clips.get(name) ?? [])
  }

  /**
   * What the band drives, which is what an `auto` block yields to. Held here rather than passed
   * at each call: keying a trajectory changes no model node, so nothing else would tell these
   * blocks to stop travelling on their own.
   */
  setTimeline(timeline: AnimationTimeline): void {
    if (timeline === this.timeline) return

    this.timeline = timeline
    for (const [nodeId, player] of this.players) this.apply(nodeId, player.lanes)
  }

  /**
   * Makes a node play the blocks the document holds, lane by lane. No lane at all puts the model
   * back to its rest pose: with no action driving them, three restores the values the file was
   * loaded with.
   */
  apply(nodeId: string, lanes: readonly ClipLane[]): void {
    const player = this.players.get(nodeId)
    if (!player) return

    player.lanes = lanes
    const onBand = nodeTravelsOnBand(this.timeline, nodeId)
    const kept = new Set<string>()

    for (const ref of lanes.flatMap(lane => lane.clips)) {
      const key = clipKeyOf(ref.source)
      const source = player.clips.get(key)
      // A block naming a clip nothing has filed plays nothing, rather than costing the whole
      // model its animation — which is also the state a shipped animation is in while it loads.
      if (!source) continue

      kept.add(ref.id)
      const travel = travelsWith(ref.rootMotion, onBand)
      const part = ref.part ?? WHOLE_BODY
      const held = player.bound.get(ref.id)
      // Rebuilt only when what the clip HOLDS changes — the travel, the bones it drives, the clip
      // itself. A speed, a fade or a move is written onto the action further down instead.
      if (held && held.travel === travel && held.key === key && held.part === part) {
        held.ref = ref
        continue
      }

      if (held) player.mixer.uncacheClip(held.clip)
      const clip = blockClip(
        source,
        player.rootTracks.get(key) ?? null,
        travel,
        drivenIn(player, part),
      )
      player.bound.set(ref.id, { ref, travel, key, part, clip })
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

  /**
   * Poses one model from a clock of its OWN, so a block can be watched without the scene's head
   * moving. `seconds` counts from the moment watching began; `null` gives the model back to the
   * head. Answers how long the clip runs, so a caller knows when one pass is over.
   */
  preview(nodeId: string, clipId: string | null, seconds: number): number {
    const player = this.players.get(nodeId)
    if (!player) return 0

    const held = clipId === null ? undefined : player.bound.get(clipId)
    if (!held) {
      this.place(player)
      return 0
    }

    const length = player.lengths[held.key] ?? 0
    const into = seconds * held.ref.speed + held.ref.offset
    const time = held.ref.loop ? (length > 0 ? into % length : 0) : Math.min(into, length)

    for (const [id, other] of player.bound) {
      const action = player.mixer.clipAction(other.clip)
      action.loop = other.ref.loop ? LoopRepeat : LoopOnce
      action.play()
      action.paused = true
      // The watched block alone drives the model: the others would blend their own pose into it.
      action.enabled = id === clipId
      action.weight = id === clipId ? 1 : 0
      if (id === clipId) action.time = time
    }

    player.mixer.update(0)
    return length
  }

  private placeAll(): void {
    for (const player of this.players.values()) this.place(player)
  }

  private place(player: Player): void {
    const sounding = new Map<string, ClipWeight>()
    for (const heard of clipBlendAt(player.lanes, player.lengths, this.playhead)) {
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
