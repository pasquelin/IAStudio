import type { ActionName, ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import type { TextureSlot } from '@shared/domain/scene'
import type { WorkspaceId } from '@shared/domain/workspace'

/**
 * What the simulated studio HOLDS — the only thing an oracle ever reads. It keeps what a person
 * could point at afterwards and call done, because what cannot be read off this cannot be scored.
 */

export type StudioFile = { path: string; kind: 'file' | 'folder' }

export type Vector = { x: number; y: number; z: number }

export const ORIGIN: Vector = { x: 0, y: 0, z: 0 }
export const UNIT: Vector = { x: 1, y: 1, z: 1 }

export type SceneNode = {
  id: string
  name: string
  /** What `node.add` was asked for — `node.sprite` and `node.material` both refuse on it. */
  kind: string
  parentId: string | null
  position: Vector
  /** Degrees, as the action takes them. */
  rotation: Vector
  scale: Vector
  visible: boolean
  textures: Partial<Record<TextureSlot, string>>
  roughness: number | null
  metalness: number | null
  /** A sprite's own picture, which is not a material — an oracle must tell the two apart. */
  sprite: string | null
  color: string | null
  /** Set for a light, and it is what "raise its intensity by 25%" is read off. */
  intensity: number | null
  /** What a camera looks at, by node id. */
  targetId: string | null
  castShadow: boolean
}

export type Layer = {
  id: string
  name: string
  kind: string
  opacity: number
  visible: boolean
  locked: boolean
  x: number
  y: number
  scale: number
  /** Degrees. */
  rotation: number
  assetId: string | null
  text: string | null
}

/** 🛑 Microseconds throughout, and `gain` in decibels — the units the montage state holds. */
export type Clip = {
  id: string
  trackId: string
  assetId: string
  start: number
  duration: number
  /** Cut off the head of the source. */
  offset: number
  gain: number
  fadeIn: number
  fadeOut: number
  speed: number
}

type Track = { id: string; kind: 'video' | 'audio'; name: string; muted: boolean }

type Keyframe = { channel: string; at: number; value: Vector }

export type Animation = { id: string; name: string; keys: Keyframe[] }

type World = {
  grid: boolean
  environment: string | null
  environmentIntensity: number
  background: string | null
  fog: boolean
  ground: boolean
  shadows: boolean
  shadowQuality: string | null
}

type Skybox = {
  source: string | null
  sunIntensity: number
  environmentIntensity: number
  adjusted: boolean
}

export type StudioDocument = {
  id: string
  title: string
  space: WorkspaceId
  path: string | null
  modified: boolean
  nodes: SceneNode[]
  layers: Layer[]
  tracks: Track[]
  clips: Clip[]
  animations: Animation[]
  /** Seconds. A 3D scene and a montage both have one, and both are asked for by name. */
  duration: number
  width: number
  height: number
  world: World
  skybox: Skybox
  /** Which picture each PBR channel of a material document holds, by channel name. */
  channels: Record<string, string>
  material: string | null
}

/** A file of the project as the catalogue holds it, plus whatever a generation added. */
export type CatalogueAsset = {
  id: string
  name: string
  type: string
  path: string | null
  /** Set when the asset came out of a generation rather than off the disk. */
  jobId: string | null
  tags: string[]
}

type Job = {
  id: string
  family: string
  modelId: string
  prompt: string
  /** The pictures it was given to work from — what "use it as a reference" has to land in. */
  references: string[]
  status: string
  assetIds: string[]
}

/** What one turn of the studio can be undone back to — the whole state, copied. */
type Snapshot = { documents: StudioDocument[]; files: StudioFile[] }

export type Bench = {
  files: StudioFile[]
  documents: StudioDocument[]
  assets: CatalogueAsset[]
  jobs: Job[]
  space: WorkspaceId | null
  frontId: string | null
  /** What the person pointed at, which is not the same as what an edit lands on. */
  selection: { kind: string; ids: string[] }
  /** The model armed per family, which a generation runs on. */
  armed: Record<string, string>
  /** The form `generator.prepare` filled and `generator.submit` sends. */
  prepared: { family: string; modelId: string; parameters: Record<string, unknown> } | null
  /** States to go back to, newest last — `files.undo` and the studio's own ⌘Z both read it. */
  past: Snapshot[]
  future: Snapshot[]
  projectName: string
  /** Actions the bench has no answer for. A scenario is never judged on one of them. */
  unmodelled: ActionName[]
  counter: number
}

export const nextId = (bench: Bench, prefix: string): string => {
  bench.counter += 1
  return `${prefix}-${bench.counter}`
}

export const front = (bench: Bench): StudioDocument | undefined =>
  bench.documents.find(one => one.id === bench.frontId)

export const refused = (why: ActionRefusal): ActionOutcome => ({ ok: false, refusal: why })

export const done: ActionOutcome = { ok: true }

export const answered = (data: unknown): ActionOutcome => ({ ok: true, data })
