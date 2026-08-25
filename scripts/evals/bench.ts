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
  /** The points of a path node, in order — empty for everything else. */
  points: Vector[]
  /** What a 3D text node reads. */
  text: string | null
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
  /** The group a layer was filed under, by layer id — `null` while it stands on its own. */
  groupId: string | null
  masked: boolean
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
  /** Whether the picture and its sound still travel together. */
  linked: boolean
}

export type Track = {
  id: string
  kind: 'video' | 'audio'
  name: string
  muted: boolean
  solo: boolean
  locked: boolean
}

/** What a model's skeleton holds, as the rig actions read and write it. */
type Rig = {
  fitted: boolean
  hands: boolean
  bones: { name: string; role: string | null }[]
  iks: string[]
}

type Guide = { id: string; axis: string; at: number }

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
  rig: Rig
  guides: Guide[]
  /** Whether a move lays its own key, which is what `animation.autoKey` switches. */
  autoKey: boolean
  captures: number
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

/** What a file operation can be undone back to — the files alone, as `undoFile` reverses. */
type Snapshot = { files: StudioFile[] }

/** What a project under version control holds, as the git actions read and write it. */
export type GitState = {
  tracked: boolean
  branch: string
  branches: string[]
  /** Files edited since the last version — what `restore` throws away and `unstage` does not. */
  changed: string[]
  staged: string[]
  commits: { message: string; files: string[] }[]
  stashes: { message: string; files: string[] }[]
  tags: string[]
  remotes: string[]
  /** Set by a conflicting merge, cleared by resolving it or giving it up. */
  merging: boolean
  conflicts: string[]
  fetched: boolean
  pushed: boolean
  pulled: boolean
}

/** The surfaces around the documents — panels, favourites, dictation, styles, accounts. */
export type ShellState = {
  fullScreen: boolean
  settingsOpen: boolean
  panels: string[]
  favorites: string[]
  dictating: boolean
  updateInstalled: boolean
  mirrored: boolean
  helpAt: string | null
  revealed: string[]
  styles: { id: string; name: string }[]
  context: Record<string, string>
  accounts: { id: string; name: string; active: boolean }[]
  /** What a cloud pull brought in and a push sent out, by asset name. */
  pulled: string[]
  pushed: string[]
  adopted: string[]
}

export const blankGit = (): GitState => ({
  tracked: false,
  branch: 'main',
  branches: ['main'],
  changed: [],
  staged: [],
  commits: [],
  stashes: [],
  tags: [],
  remotes: [],
  merging: false,
  conflicts: [],
  fetched: false,
  pushed: false,
  pulled: false,
})

export const blankShell = (): ShellState => ({
  fullScreen: false,
  settingsOpen: false,
  panels: [],
  favorites: [],
  dictating: false,
  updateInstalled: false,
  mirrored: false,
  helpAt: null,
  revealed: [],
  styles: [],
  context: {},
  accounts: [
    { id: 'account-1', name: 'Studio', active: true },
    { id: 'account-2', name: 'Perso', active: false },
  ],
  pulled: [],
  pushed: [],
  adopted: [],
})

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
  git: GitState
  shell: ShellState
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
