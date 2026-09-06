/**
 * The shipped character, strolling. Loads through the studio's own glTF source, borrows the
 * shipped clips through the studio's own retarget, and plays them on ONE clock — the walk's.
 */
import {
  AnimationClip,
  AnimationMixer,
  Group,
  LoopRepeat,
  PropertyBinding,
  SkinnedMesh,
  Vector3,
  type AnimationAction,
  type Object3D,
} from 'three'
import { bundledAnimationUrl } from '@shared/domain/animationLibrary'
import { bundledCharacterUrl } from '@shared/domain/bundledCharacter'
import { WELCOME_CLIP_NAMES, type WelcomeClipName } from '@shared/domain/welcome'
import { clamp } from '@shared/numeric'
import { clipsOf } from '../scene/animation'
import { disposeTree } from '../scene/modelCache'
import { skeletonBonesOf, type SkeletonBone } from '../scene/rigState'
import { rootTrackOf } from '../scene/rootMotion'
import type { GltfSource } from '../scene/gltfSource'
import type { Retarget } from '../scene/retarget'
import { WELCOME_GROVE } from './welcomeGrove'
import {
  welcomeRootFit,
  welcomeRootMotion,
  welcomeStepOver,
  type WelcomeRootMotion,
} from './welcomeRoot'
import {
  welcomeAdvance,
  welcomeTurnOver,
  welcomeWalkStart,
  type WelcomeStep,
  type WelcomeWalkState,
} from './welcomeWalk'

/** The density Alban asked the welcome to show, of the four the app ships. */
const WELCOME_LEVEL = 'ultra'

/** How long one clip takes to give way to the next. Short — a stroll, not a dissolve. */
const FADE = 0.22

/**
 * What a standing walker is posed by: the LAST frame of `WalkStop`, which is a stand. Nothing
 * shipped is an idle, and a mixer with every weight at zero holds whatever it wrote last.
 */
const IDLE: WelcomeClipName = 'WalkStop'

/** How many instants of a walk cycle `plant` measures the soles at. */
const PLANT_STEPS = 24

const STILL: WelcomeStep = { x: 0, z: 0, turned: 0 }

type Played = {
  name: WelcomeClipName
  action: AnimationAction
  duration: number
  /** The clip's own root, read off the SOURCE file and at the character's size. */
  root: WelcomeRootMotion
}

type Fading = { played: Played; time: number; left: number }

export type WelcomeHeroDeps = {
  gltf: GltfSource
  retarget: Retarget
  /** Called when the character lands, and on every frame it owes a draw. */
  onReady: () => void
  onFailure: (error: unknown) => void
}

export class WelcomeHero {
  readonly group = new Group()
  private readonly played = new Map<WelcomeClipName, Played>()
  private body: Object3D | null = null
  private mixer: AnimationMixer | null = null
  private walk: WelcomeWalkState = welcomeWalkStart()
  /** Where the character's own root rides at rest — what a clip's height is an offset from. */
  private rest = 0
  /** How far the lowest foot misses the floor by, measured once. See `plant`. */
  private floor = 0
  /** The toe bones, found once: `plant` samples them two dozen times over. */
  private toes: readonly Object3D[] = []
  private fading: Fading | null = null
  private disposed = false

  constructor(private readonly deps: WelcomeHeroDeps) {
    void this.load()
  }

  /**
   * One frame of the stroll. `seconds` arrives clamped by the caller — a window that comes back
   * from being hidden hands out the whole absence, and a walker would cross the yard in one step.
   */
  advance(seconds: number): void {
    if (!this.mixer) return

    const played = this.playing()
    this.walk = welcomeAdvance(this.walk, played ? this.stepped(played, seconds) : STILL, seconds)
    if (played ? this.walk.time >= played.duration : this.walk.pause <= 0) {
      this.turnOver(played?.duration)
    }

    if (this.fading) this.fading = fadedBy(this.fading, seconds)
    this.pose()
  }

  /** The still a reduced-motion window shows: standing in the open, where the walk begins. */
  settle(): void {
    this.walk = welcomeWalkStart()
    this.fading = null
    this.pose()
  }

  dispose(): void {
    this.disposed = true
    this.mixer?.stopAllAction()
    if (this.body) {
      this.mixer?.uncacheRoot(this.body)
      disposeTree(this.body)
    }
    this.body = null
    this.mixer = null
    this.toes = []
    this.played.clear()
  }

  private async load(): Promise<void> {
    try {
      const loading = WELCOME_CLIP_NAMES.map(name =>
        this.deps.gltf.loadAnimation(bundledAnimationUrl(name)),
      )
      const body = await this.deps.gltf.load(bundledCharacterUrl(WELCOME_LEVEL))
      const files = await Promise.all(loading)
      if (this.disposed) return void disposeTree(body)

      const mixer = new AnimationMixer(body)
      const adapted = await Promise.all(
        files.map(async file => (await this.deps.retarget.adapt(body, file, clipsOf(file)))?.[0]),
      )
      if (this.disposed) return void disposeTree(body)

      const bones = skeletonBonesOf(body)
      this.rest = fill(this.played, { body, bones, files, adapted, mixer })
      for (const file of files) disposeTree(file)

      castAndKeep(body)
      this.group.add(body)
      this.body = body
      this.mixer = mixer
      this.toes = toesOf(body, bones)
      this.plant()
      this.pose()
      this.deps.onReady()
    } catch (error) {
      this.deps.onFailure(error)
    }
  }

  private playing(): Played | null {
    return this.walk.clip ? (this.played.get(this.walk.clip) ?? null) : null
  }

  /**
   * What the playing clip does to the body over `seconds`, blended with whatever is fading out and
   * turned into the walker's frame — by their heading LESS the yaw the clip has already spent, so
   * a path that steers mid-clip still carries the feet where they point.
   */
  private stepped(played: Played, seconds: number): WelcomeStep {
    const own = stepOf(played, this.walk.time, seconds)
    const blend = this.fading
      ? mixSteps(own, stepOf(this.fading.played, this.fading.time, seconds), this.weight())
      : own
    const spin = this.walk.heading - played.root.turnAt(this.walk.time)
    const cos = Math.cos(spin)
    const sin = Math.sin(spin)

    return {
      x: blend.x * cos + blend.z * sin,
      z: blend.z * cos - blend.x * sin,
      turned: blend.turned,
    }
  }

  /**
   * Sets the character ON the floor, by their feet rather than by their hips: a stride belongs to
   * a leg, so replayed on shorter ones the hips ride true and the soles stop short. Measured over
   * a whole walk cycle — 11 cm on the shipped character, 2026-09-06 — and taken off once.
   */
  private plant(): void {
    const walk = this.played.get('Walk')
    const body = this.body
    if (!walk || !body) return

    let lowest = Infinity
    for (let step = 0; step <= PLANT_STEPS; step += 1) {
      this.walk = { ...this.walk, clip: 'Walk', time: (step / PLANT_STEPS) * walk.duration }
      this.pose()
      body.updateWorldMatrix(true, true)
      for (const toe of this.toes) lowest = Math.min(lowest, soleOf(toe))
    }

    this.floor = Number.isFinite(lowest) ? lowest : 0
    this.walk = welcomeWalkStart()
  }

  /** How high the body rides this frame — the walk's bounce, and the whole arc of a jump. */
  private riding(): number {
    const played = this.playing()
    const own = played ? played.root.heightAt(this.walk.time) : this.rest
    const rode = this.fading
      ? blended(own, this.fading.played.root.heightAt(this.fading.time), this.weight())
      : own

    return rode - this.rest - this.floor
  }

  /** How much of the pose the incoming clip owns. One while nothing is fading out. */
  private weight(): number {
    return this.fading ? 1 - this.fading.left / FADE : 1
  }

  /**
   * The clip has run out, or the stand has: choose the next one and hand the old one a fade. A
   * clip chosen again is LOOPED rather than restarted — dropped, its overrun cost a walk up to a
   * frame per cycle and the stride stuttered once a second.
   */
  private turnOver(duration = 0): void {
    const held = this.playing()
    const over = Math.max(0, this.walk.time - duration)
    const time = this.walk.time
    this.walk = welcomeTurnOver(this.walk, WELCOME_GROVE, Math.random)

    if (held && this.walk.clip === held.name) this.walk = { ...this.walk, time: over }
    else if (held) this.fading = { played: held, time, left: FADE }
  }

  /**
   * Every action written straight to its instant and weight, then ONE `update(0)`: the walk's
   * time is the only clock here, so a fade never depends on how playback reached the frame.
   */
  private pose(): void {
    if (!this.mixer) return

    const weight = this.weight()
    const showing = this.walk.clip ?? IDLE
    for (const played of this.played.values()) {
      const playing = played.name === showing
      const leaving = played === this.fading?.played
      played.action.enabled = playing || leaving
      played.action.weight = playing ? weight : leaving ? 1 - weight : 0
      played.action.time = clamp(this.instantOf(playing, played), 0, played.duration)
    }

    this.group.position.set(this.walk.x, this.riding(), this.walk.z)
    this.group.rotation.y = this.walk.heading
    this.mixer.update(0)
  }

  /** A standing walker is held on the LAST frame of their clip, which is what `IDLE` is for. */
  private instantOf(playing: boolean, played: Played): number {
    if (!playing) return this.fading?.time ?? 0

    return this.walk.clip ? this.walk.time : played.duration
  }
}

type Loaded = {
  body: Object3D
  bones: readonly SkeletonBone[]
  files: readonly (Object3D | undefined)[]
  adapted: readonly (AnimationClip | undefined)[]
  mixer: AnimationMixer
}

/**
 * Fills `played` with every clip that came back whole, and answers the height the character's own
 * root rides at. Read BEFORE the sources are let go: their own frames are what put the travel back
 * on the ground and the turn back about Y, and the retargeted clip carries neither.
 */
function fill(played: Map<WelcomeClipName, Played>, loaded: Loaded): number {
  let rest = 0
  for (const [index, name] of WELCOME_CLIP_NAMES.entries()) {
    const clip = loaded.adapted[index]
    const file = loaded.files[index]
    const raw = file && clipsOf(file)[0]
    if (!clip || !raw) continue

    const source = rootOf(file, raw, skeletonBonesOf(file))
    const target = rootOf(loaded.body, clip, loaded.bones)
    if (!source.bone || !target.bone || !target.track) continue

    const fit = welcomeRootFit(target.bone, source.bone)
    rest = fit.rest
    played.set(
      name,
      playedOf(
        name,
        loaded.mixer,
        clip,
        target.track,
        welcomeRootMotion(raw, source.bone, fit.scale),
      ),
    )
  }

  return rest
}

function castAndKeep(body: Object3D): void {
  body.traverse(object => {
    if (!(object instanceof SkinnedMesh)) return
    object.castShadow = true
    // A skinned mesh's bounds are its BIND pose, and a leg thrown forward leaves them: the whole
    // character blinks out the moment its box misses the frustum's edge.
    object.frustumCulled = false
  })
}

/** The bones a sole is measured at, by ROLE — a rig may spell its toes half a dozen ways. */
function toesOf(body: Object3D, bones: readonly SkeletonBone[]): readonly Object3D[] {
  return bones.flatMap(bone => {
    if (bone.role !== 'LeftToes' && bone.role !== 'RightToes') return []
    const found = body.getObjectByName(bone.name)

    return found ? [found] : []
  })
}

/** The bone a clip drives a body BY, with the track that names it. */
function rootOf(
  tree: Object3D,
  clip: AnimationClip,
  bones: readonly SkeletonBone[],
): { bone: Object3D | null; track: string | null } {
  const track = rootTrackOf(clip, bones)
  const name = track === null ? null : PropertyBinding.parseTrackName(track).nodeName

  return { bone: name ? (tree.getObjectByName(name) ?? null) : null, track }
}

function playedOf(
  name: WelcomeClipName,
  mixer: AnimationMixer,
  clip: AnimationClip,
  track: string,
  root: WelcomeRootMotion,
): Played {
  // 🛑 BOTH root channels dropped, not pinned. The group carries the travel, the height and the
  // yaw; left in the pose as well, every one of them would be paid twice.
  const spun = `${PropertyBinding.parseTrackName(track).nodeName}.quaternion`
  const held = new AnimationClip(
    clip.name,
    clip.duration,
    clip.tracks.filter(one => one.name !== track && one.name !== spun),
  )
  const action = mixer.clipAction(held)
  action.loop = LoopRepeat
  // Paused, and never unpaused: `pose` writes the instant, so a mixer left running would move
  // the character a second time, at its own rate.
  action.play()
  action.paused = true

  return { name, action, duration: clip.duration, root }
}

const stepOf = (played: Played, from: number, seconds: number): WelcomeStep =>
  welcomeStepOver(played.root, played.duration, from, seconds)

/** One number crossfading into another. */
const blended = (own: number, leaving: number, weight: number): number =>
  own * weight + leaving * (1 - weight)

/** Where a toe bone's world position stands. The sole is what has to reach the floor, not the hip. */
function soleOf(bone: Object3D): number {
  return new Vector3().setFromMatrixPosition(bone.matrixWorld).y
}

const mixSteps = (own: WelcomeStep, leaving: WelcomeStep, weight: number): WelcomeStep => ({
  x: blended(own.x, leaving.x, weight),
  z: blended(own.z, leaving.z, weight),
  turned: blended(own.turned, leaving.turned, weight),
})

const fadedBy = (fading: Fading, seconds: number): Fading | null =>
  fading.left <= seconds
    ? null
    : { ...fading, time: fading.time + seconds, left: fading.left - seconds }
