import type { CameraShot, Keyframe, TrackProperty } from '@shared/domain/animation'
import { commitmentOfCall, type ActionName } from '@shared/domain/assistant'
import type { Asset } from '@shared/domain/asset'
import type { DocumentDescriptor } from '@shared/domain/document'
import { isRecord } from '@shared/guards'
import type { Job } from '@shared/domain/job'
import type { WorkspaceId } from '@shared/domain/workspace'
import { allLayers, type Layer } from '@/engines/canvas/canvasState'
import type { SceneNode } from '@/engines/scene/sceneState'
import { clipEnd, type Clip, type Track } from '@/engines/timeline/timelineState'
import { isNeutral } from '@shared/domain/adjustments'
import type { CsgOperation } from '@shared/domain/csg'
import { toRadians } from '@shared/domain/angles'
import { SECOND } from '@shared/domain/time'
import { matchesWords, searchWords } from '@shared/text'
import type { ModelMaterial } from '@shared/domain/scene'
import type { SkyboxContent } from '@shared/domain/skybox'
import type { TextureState } from '@/engines/texture/textureState'
import { toDb } from '@/engines/audio/audioData'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { sceneOf, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { skyboxViewOf, useSkyboxViews } from '@/stores/skyboxViews'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { skyboxOf, useSkyboxes } from '@/stores/skyboxes'
import { textureOf, useTextures } from '@/stores/textures'
import type { Run } from './run'

export { SECOND }

/**
 * 🛑 An oracle reads the STATE, never the words the model wrote: every failure this bench exists
 * for was announced as a success by the model itself. The units are the state's, not the
 * action's — a node's rotation and a LAYER's are both in radians here.
 */

export const documents = (run: Run): readonly DocumentDescriptor[] => run.studio.documents()

export const inSpace = (run: Run, space: WorkspaceId): readonly DocumentDescriptor[] =>
  documents(run).filter(one => one.workspace === space)

/** The studio's own rule for « does this name answer this word » — it folds the diacritics. */
const answersTo = (name: string, wanted: string): boolean => matchesWords(name, searchWords(wanted))

export const titled = (run: Run, title: string): DocumentDescriptor | undefined =>
  documents(run).find(one => answersTo(one.title, title))

/**
 * 🛑 Title OR path, never `path || title`: opening a PICTURE makes an image document, whose path
 * is `documents/<name>.ora`. Written the other way, `2.1` could not pass — the studio did exactly
 * what was asked and the path ended in `.ora`. Measured on the bench pass of 2026-08-25.
 */
export const openedFile = (run: Run, ending: string): boolean =>
  documents(run).some(one => one.title.endsWith(ending) || (one.path ?? '').endsWith(ending))

export const front = (run: Run): DocumentDescriptor | null => run.studio.front()

export const nodes = (run: Run): readonly SceneNode[] =>
  inSpace(run, '3d').flatMap(one => sceneOf(useScenes.getState(), one.id).nodes)

export const nodeNamed = (run: Run, name: string): SceneNode | undefined =>
  nodes(run).find(one => answersTo(one.name, name))

/**
 * What a node was ADDED as — the word `node.add` takes, which the state spells across two
 * fields: a box is a MESH carrying a box geometry, and a sun a LIGHT carrying a directional one.
 */
const kindOf = (node: SceneNode): string =>
  node.type === 'mesh' ? node.geometry.kind : node.type === 'light' ? node.light.kind : node.type

export const nodesOfKind = (run: Run, ...kinds: string[]): readonly SceneNode[] =>
  nodes(run).filter(one => kinds.includes(kindOf(one)))

/**
 * The one solid a fold produced, and BY WHICH verb — three buttons that all leave « a solid »
 * behind are three scenarios one wrong answer would pass. Read off the graph's own steps.
 */
export const carvedBy = (run: Run, operation: CsgOperation): boolean => {
  const solids = nodes(run).filter(one => one.type === 'carved')
  const only = solids.length === 1 ? solids[0] : undefined
  return only?.type === 'carved' && only.carved.steps.every(one => one.operation === operation)
}

/** The same word, for the node a sentence names — « renomme-la Soleil Test » scores on both. */
export const kindNamed = (run: Run, name: string): string | null => {
  const node = nodeNamed(run, name)
  return node ? kindOf(node) : null
}

/**
 * The half of a node its TYPE carries — a light's intensity, a solid's material, a rail's points.
 * `SceneNode` is a union, and every oracle that reads one of these has to narrow first.
 */
export const lightOf = (node?: SceneNode) => (node?.type === 'light' ? node.light : null)

export const materialOf = (node?: SceneNode) =>
  node && (node.type === 'mesh' || node.type === 'text') ? node.material : null

export const pathOf = (node?: SceneNode) => (node?.type === 'path' ? node.path : null)

export const spriteOf = (node?: SceneNode) => (node?.type === 'sprite' ? node.sprite : null)

export const wordsOf = (node?: SceneNode) => (node?.type === 'text' ? node.text : null)

/** What a layer of words reads. `null` on every other kind, which carries none. */
export const captionOf = (layer?: Layer) => (layer?.kind === 'text' ? layer.text : null)

/** The shots of the open scene — where a camera's target lives, since a node carries none. */
export const shots = (run: Run): readonly CameraShot[] =>
  inSpace(run, '3d').flatMap(one => sceneOf(useScenes.getState(), one.id).animation.shots)

/**
 * Whether a camera is AIMED rather than left free. A target is set on a SHOT — `camera.shot`
 * then `camera.target` — which is exactly what « fais-la regarder » has to find out.
 */
export const aimsAt = (run: Run, at?: string): boolean =>
  shots(run).some(
    one =>
      one.target !== undefined &&
      (at === undefined || (one.target.kind === 'node' && one.target.nodeId === at)),
  )

/** The state of the FIRST document of a space, or `null` when none is open. */
const firstOf = <T>(run: Run, space: WorkspaceId, read: (documentId: string) => T): T | null => {
  const document = inSpace(run, space)[0]
  return document ? read(document.id) : null
}

/** The scene the batterie talks about — the first 3D document, which every decor opens alone. */
const openScene = (run: Run) => firstOf(run, '3d', id => sceneOf(useScenes.getState(), id))

/** How the open scene is being LOOKED at — the display mode and the panes, which no file holds. */
export const sceneView = (run: Run) =>
  firstOf(run, '3d', id => sceneViewOf(useSceneViews.getState(), id))

/** How the open sky is being looked at — its probes, its shape, its background. */
export const skyView = (run: Run) =>
  firstOf(run, 'skyboxes', id => skyboxViewOf(useSkyboxViews.getState(), id))

/** The open montage — where its head stands, and the rows it holds. */
export const montage = (run: Run) => {
  const shown = front(run)
  return shown && (shown.kind === 'sequence' || shown.kind === 'audio')
    ? sequenceOf(useSequences.getState(), shown.id)
    : null
}

/** How the open scene's animation band is set — where automatic keying is held. */
export const animationView = (run: Run) =>
  firstOf(run, '3d', id => animationViewOf(useAnimationViews.getState(), id))

/** The skeleton of the model in the open scene — a rig lives on its node's `model`, nowhere else. */
export const rig = (run: Run) => {
  const model = nodes(run).find(one => one.type === 'model')
  return model?.type === 'model' ? (model.model.rig ?? null) : null
}

/**
 * What an imported model wears OVER its file: the finish rides on `model.material`, never on the
 * node's own — a `.glb` carries a material per mesh, and the node is one row standing for all.
 */
export const modelFinish = (run: Run, name: string): ModelMaterial | null => {
  const node = nodeNamed(run, name)
  return node?.type === 'model' ? (node.model.material ?? null) : null
}

/** The open picture itself — its size and its guides, which no layer carries. */
export const canvas = (run: Run) =>
  firstOf(run, 'image', id => canvasOf(useCanvases.getState(), id))

/**
 * What the document in front DESIGNATES, and of what kind — « sélectionne le calque » is not
 * « pointe quelque chose », and only the kind tells the two apart.
 */
export const aimed = (run: Run): { kind: string; ids: readonly string[] } => {
  const shown = front(run)
  if (!shown) return { kind: 'none', ids: [] }

  if (shown.kind === 'scene') {
    return { kind: 'node', ids: sceneOf(useScenes.getState(), shown.id).selectedIds }
  }

  if (shown.kind === 'image') {
    const active = canvasOf(useCanvases.getState(), shown.id).activeLayerId
    return { kind: 'layer', ids: active === null ? [] : [active] }
  }

  if (shown.kind === 'sequence' || shown.kind === 'audio') {
    const montage = sequenceOf(useSequences.getState(), shown.id)
    return montage.selectedId === null
      ? { kind: 'track', ids: montage.selectedTrackId === null ? [] : [montage.selectedTrackId] }
      : { kind: 'clip', ids: [montage.selectedId] }
  }

  return { kind: 'none', ids: [] }
}

/** What lights the open scene and what hangs behind it — the world belongs to no node. */
export const world = (run: Run) => openScene(run)?.world ?? null

/** How long the open scene's timeline runs, in the microseconds it counts in. */
export const sceneLasts = (run: Run): number => openScene(run)?.animation.duration ?? 0

/** The sky the open skybox document holds. */
export const sky = (run: Run): SkyboxContent | null =>
  firstOf(run, 'skyboxes', id => skyboxOf(useSkyboxes.getState(), id))

/** Whether the sky's colour stack has been moved off neutral — `isNeutral` is what says so. */
export const adjusted = (run: Run): boolean => {
  const content = sky(run)
  return content !== null && !isNeutral(content.adjustments)
}

/** The matter the open texture document assembles — its channels and its surface settings. */
export const surface = (run: Run): TextureState | null =>
  firstOf(run, 'textures', id => textureOf(useTextures.getState(), id))

/** Every layer of every open picture, groups opened out — a stack nests, an oracle does not. */
export const layers = (run: Run): readonly Layer[] =>
  inSpace(run, 'image').flatMap(one => allLayers(canvasOf(useCanvases.getState(), one.id).layers))

export const layerNamed = (run: Run, name: string): Layer | undefined =>
  layers(run).find(one => answersTo(one.name, name))

/** The tracks of every open montage — the video space and the audio one both edit one. */
export const tracks = (run: Run): readonly Track[] =>
  documents(run)
    .filter(one => one.kind === 'sequence' || one.kind === 'audio')
    .flatMap(one => sequenceOf(useSequences.getState(), one.id).tracks)

/**
 * Every clip of every open montage, each carrying the track it sits on: a track HOLDS its clips,
 * and half the montage oracles are about which row something landed on.
 */
export const clips = (run: Run): readonly (Clip & { trackId: string })[] =>
  tracks(run).flatMap(track => track.clips.map(clip => ({ ...clip, trackId: track.id })))

export const files = (run: Run): readonly string[] => run.studio.files()

export const holds = (run: Run, path: string): boolean => files(run).includes(path)

export const assets = (run: Run): readonly Asset[] => run.studio.assets()

export const jobs = (run: Run): readonly Job[] => run.studio.jobs()

/** Whether a generation ran at all, which is what every section-20 scenario turns on. */
export const generated = (run: Run, family?: string): boolean =>
  jobs(run).some(
    one =>
      one.status === 'succeeded' &&
      (family === undefined || run.studio.familyOf(one.targetId) === family),
  )

/**
 * Read off what the generator SENT, never off the call's text: an id quoted in a prompt is not a
 * reference, and which fields hold a picture is the model's schema to say.
 */
export const referenced = (run: Run, assetId: string): boolean =>
  run.studio.references().includes(assetId)

/** A turn the person named in DEGREES, in the RADIANS the state holds — a layer's included. */
export const radians = toRadians

/** Roughly equal, because a model answering 2 m as 2.0 has answered. */
export const near = (value: number, wanted: number, slack = 0.001): boolean =>
  Math.abs(value - wanted) <= slack

/** What a read-only turn is allowed to do: look, and say. Nothing that outlives the looking. */
export const changedNothing = (run: Run): boolean => !run.studio.changed()

/** Looked and said, and nothing more: no call that commits, and nothing left changed. */
export const lookedOnly = (run: Run): boolean =>
  run.called.every(one => commitmentOfCall(one.action, one.input) === 'none') && changedNothing(run)

/** Where a montage ends: the last frame any clip reaches, which is what « exactly » reads on. */
export const endOf = (of: readonly Clip[]): number =>
  of.reduce((last, one) => Math.max(last, clipEnd(one)), 0)

/** What the model answered a question WITH — a sentence, not an empty turn. */
export const spoke = (run: Run): boolean => run.said.trim().length > 0

export const askedBack = (run: Run): boolean => /\?/.test(run.said)

/** The data an action answered, for the rare oracle that must read a reply rather than a state. */
export const answeredWith = (run: Run, action: string): boolean =>
  run.called.some(one => one.action === action && one.answer?.startsWith('refused') === false)

/** Roughly this many seconds, read off a value the montage keeps in microseconds. */
export const lasts = (value: number, seconds: number): boolean =>
  near(value, seconds * SECOND, SECOND / 100)

/**
 * A gain the person named as a percentage, in the DECIBELS the state holds — `20·log₁₀`. Half
 * volume is −6 dB and not 0.5, and a bench reading fractions passed the wrong answer.
 */
export const quietedTo = (value: number, percent: number): boolean =>
  near(value, toDb(percent / 100), 0.6)

/**
 * Every key of the open 3D scenes, each carrying the channel it drives: the channel is the
 * track's, and nine oracles ask which of the three moved.
 */
export const keys = (run: Run): readonly (Keyframe & { channel: TrackProperty })[] =>
  inSpace(run, '3d')
    .flatMap(one => sceneOf(useScenes.getState(), one.id).animation.tracks)
    .flatMap(track => track.keys.map(key => ({ ...key, channel: track.target.property })))

/** The sound row of the open montage, which eight oracles reach for. */
export const audioRow = (run: Run): Track | undefined =>
  tracks(run).find(one => one.kind === 'audio')

export const audioTrack = (run: Run): string | undefined => audioRow(run)?.id

/** Looked and said, and nothing more — what every read-only request of the batterie asks. */
export const idle = (run: Run): boolean => spoke(run) && lookedOnly(run)

/** Whether this node stands somewhere other than where the decor left it. */
export const moved = (run: Run, of: string | SceneNode): boolean => {
  const node = typeof of === 'string' ? nodeNamed(run, of) : of
  return node !== undefined && run.studio.wasAt(node.id) !== JSON.stringify(node.transform)
}

/**
 * Aimed by a shot, or MOVED since the person spoke. 🛑 Not « off the origin »: a fresh camera
 * stands at (0, 2, 6), so that reading was true of every camera a decor had just added.
 */
export const framing = (run: Run, name?: string): boolean => {
  const camera = name === undefined ? nodesOfKind(run, 'camera')[0] : nodeNamed(run, name)
  return camera !== undefined && (aimsAt(run) || moved(run, camera))
}

/**
 * A settings write naming a section AND a key of it: the grid and the shadows have no action of
 * their own, and « any settings.write » would pass on one about something else.
 */
export const wrote = (run: Run, section: string, key: string): boolean =>
  run.called.some(one => {
    if (one.action !== 'settings.write') return false

    const asked = one.input['settings']
    const written = isRecord(asked) ? asked[section] : undefined
    return isRecord(written) && Object.keys(written).some(name => name.toLowerCase().includes(key))
  })

/** Whether a search was actually run, and on a word the sentence carries. */
export const searched = (run: Run, word: string): boolean =>
  run.called.some(
    one =>
      (one.action === 'files.search' || one.action === 'assets.search') &&
      Object.values(one.input).some(
        value => typeof value === 'string' && value.toLowerCase().includes(word),
      ),
  )

/** Whether an action ran at all, refused or not — what an undo scenario has to see happen. */
export const tried = (run: Run, name: ActionName): boolean =>
  run.called.some(one => one.action === name)
