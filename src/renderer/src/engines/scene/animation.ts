import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationClip, type Object3D } from 'three'
import type { AnimationRef } from '@shared/domain/scene'
import { usToSeconds, type Us } from '@shared/domain/time'

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

type Player = {
  mixer: AnimationMixer
  clips: AnimationClip[]
  /** What is bound right now, so an unchanged reference does not rebuild the action every sync. */
  bound: AnimationRef | null
}

/**
 * The animation clips of every model in the scene, driven from what the document says.
 *
 * A registry apart from the nodes, on `bvh-inflight`'s pattern: a mixer is a live three object
 * bound to one instance, while a document holds a clip name and four numbers. Keeping the two
 * apart is what lets a viewport be thrown away and rebuilt in another window — and it is what
 * makes any of this testable, since a mixer needs no GPU at all.
 */
export class SceneAnimations {
  private readonly players = new Map<string, Player>()

  /**
   * Binds a node to the instance the file produced. The clips come from the cached source rather
   * than the clone: `Object3D.copy` does not carry them, and a clip addresses its targets by
   * name, so the source's clips drive any instance built from it.
   */
  add(nodeId: string, root: Object3D, clips: AnimationClip[]): void {
    if (clips.length === 0) return

    this.remove(nodeId)
    this.players.set(nodeId, { mixer: new AnimationMixer(root), clips, bound: null })
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

  /**
   * Makes a node play what the document says. `null` puts the model back to its rest pose: with
   * no action left driving them, three restores the values the file was loaded with.
   */
  apply(nodeId: string, ref: AnimationRef | null): void {
    const player = this.players.get(nodeId)
    if (!player) return

    if (!ref) {
      player.mixer.stopAllAction()
      player.bound = null
      // Nothing advances, but the restored pose has to reach the objects before the next frame.
      player.mixer.update(0)
      return
    }

    const clip = player.clips.find(candidate => candidate.name === ref.clip)
    if (!clip) return

    // A clip change is the only thing that costs a rebuild; the rest is written onto the action
    // that is already running, so changing the speed does not restart what it is playing.
    const changed = player.bound?.clip !== ref.clip
    if (changed) {
      player.mixer.stopAllAction()
      player.mixer.clipAction(clip).play()
    }

    const action = player.mixer.clipAction(clip)
    action.paused = !ref.playing
    action.timeScale = ref.speed
    action.loop = ref.loop ? LoopRepeat : LoopOnce
    // Without it a clip played once snaps back to its first frame the instant it ends, which
    // reads as the model teleporting rather than as an animation finishing.
    action.clampWhenFinished = !ref.loop

    // Only when the DOCUMENT moved the head, never on every apply: the reference carries where
    // the head stands, so re-applying it on a speed change would drag playback back to where it
    // was when that reference was written.
    if (changed || ref.time !== player.bound?.time) action.time = ref.time

    player.bound = ref
    // A seek has to show without waiting for a frame, and a paused player never gets one.
    player.mixer.update(0)
  }

  /**
   * Advances every mixer, and answers whether anything actually moved — which is what keeps the
   * viewport's frame loop awake, and lets it fall asleep when nothing does.
   */
  update(delta: number): boolean {
    let moved = false

    for (const player of this.players.values()) {
      if (!player.bound?.playing) continue
      player.mixer.update(delta)
      moved = true
    }
    return moved
  }

  /**
   * Puts every clip where the scene's HEAD says, rather than where real time left it.
   *
   * This is what makes a clip a block on the band: before its start the model stands at the
   * clip's first frame, after its end at the last one, and a render — which never advances real
   * time at all — walks the clip frame by frame instead of writing the same pose a thousand
   * times. A film of a walking character came out frozen for exactly that reason.
   */
  seek(playhead: Us): void {
    for (const player of this.players.values()) {
      const ref = player.bound
      if (!ref) continue

      const clip = player.clips.find(candidate => candidate.name === ref.clip)
      if (!clip) continue

      player.mixer.clipAction(clip).time = clipTimeAt(ref, clip.duration, playhead)
      player.mixer.update(0)
    }
  }
}

/**
 * Where inside a clip the head stands, in the seconds three counts in.
 *
 * Held apart from the mixer so it can be tested without one: everything that can go wrong here —
 * a head before the block, a looping clip, a speed — is arithmetic.
 */
export function clipTimeAt(ref: AnimationRef, duration: number, playhead: Us): number {
  const into = usToSeconds(Math.max(0, playhead - ref.start)) * ref.speed
  if (duration <= 0) return 0

  // A clip that loops wraps; one that does not holds its last frame, which is what
  // `clampWhenFinished` promises the moment it finishes.
  return ref.loop ? into % duration : Math.min(into, duration)
}
