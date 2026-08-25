import {
  assistantAction,
  validatesInput,
  type ActionName,
  type ActionOutcome,
} from '@shared/domain/assistant'
import { isRecord } from '@shared/guards'
import { pathBaseNameOf } from '@shared/domain/fileName'
import { natureOf } from '@shared/domain/fileRole'
import type { Target, TargetKind } from '@shared/domain/target'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import {
  answered,
  blankGit,
  blankShell,
  done,
  front,
  nextId,
  refused,
  type Bench,
  type StudioDocument,
  type StudioFile,
} from './bench'
import { fileAction, remember } from './fakeFiles'
import { gitAction } from './fakeGit'
import { shellAction } from './fakeShell'
import { rigAction } from './fakeRig'
import { imageAction } from './fakeImage'
import { libraryAction } from './fakeLibrary'
import { montageAction } from './fakeMontage'
import { sceneAction } from './fakeScene'
import { surfaceAction } from './fakeSurfaces'
import { flag, text, type Input } from './inputs'

/**
 * A studio that refuses where the studio refuses, and answers the shapes the handlers answer —
 * because what the model CHOOSES next is decided by what each call answered. An action it does
 * not know answers `ok` with nothing, and is named apart so nothing is scored blind on it.
 */
export type { StudioFile } from './bench'

export type FakeStudio = {
  run: (action: ActionName, input: Record<string, unknown>) => ActionOutcome
  /** What the briefing tells the model the studio is, in the sentences `describeStudio` writes. */
  state: () => string
  /** What the open document can be aimed at — the app passes these on every round. */
  targets: () => readonly Target[]
  documents: () => readonly StudioDocument[]
  front: () => StudioDocument | null
  bench: () => Bench
  /** Actions this studio has no answer for — a scenario is never judged on one of them. */
  unmodelled: () => readonly ActionName[]
  /** Every call it refused, named. A DECOR that hits one has laid out nothing — see its guard. */
  refusals: () => readonly string[]
  /**
   * 🛑 Called once the decor is laid out, so what the DECOR changed is not scored as what the
   * MODEL changed. Without it `changedNothing` was false before the person had spoken, and the
   * seventeen read-only scenarios — the whole of section 30 included — could not be green.
   */
  settle: () => void
}

/** The spaces whose actions need a document of their own kind in front. */
const SPACE_OF_PREFIX: Partial<Record<string, WorkspaceId>> = {
  'node.': '3d',
  'scene.': '3d',
  'camera.': '3d',
  'world.': '3d',
  'view.': '3d',
  'path.': '3d',
  'rig.': '3d',
  'bone.': '3d',
  'ik.': '3d',
  'animation.': '3d',
  'animations.': '3d',
  'key.': '3d',
  'model.textures': '3d',
  'layer.': 'image',
  'canvas.': 'image',
  'guide.': 'image',
  'skybox.': 'skyboxes',
  'texture.': 'textures',
  'channel.': '3d',
}

const spaceNeededBy = (action: string): WorkspaceId | null =>
  Object.entries(SPACE_OF_PREFIX).find(([prefix]) => action.startsWith(prefix))?.[1] ?? null

/** Which space a montage action belongs to: either of the two the studio edits a timeline in. */
const MONTAGE_PREFIXES = ['clip.', 'track.', 'sequence.']

/** What space a file opens into — a `.glb` is a model, and the folder it sits in says nothing. */
const spaceOfFile = (path: string): WorkspaceId => {
  const domain = natureOf(path).domain
  if (domain === 'mesh') return '3d'
  if (domain === 'video') return 'video'
  if (domain === 'audio') return 'audio'
  return 'image'
}

function blankDocument(bench: Bench, title: string, at: WorkspaceId): StudioDocument {
  return {
    id: nextId(bench, 'doc'),
    title,
    space: at,
    path: null,
    modified: false,
    nodes: [],
    layers: [],
    tracks: [],
    clips: [],
    animations: [],
    duration: at === '3d' ? 5 : 0,
    width: 1920,
    height: 1080,
    world: {
      grid: false,
      environment: null,
      environmentIntensity: 1,
      background: null,
      fog: false,
      ground: false,
      shadows: false,
      shadowQuality: null,
    },
    rig: { fitted: false, hands: false, bones: [], iks: [] },
    guides: [],
    autoKey: false,
    captures: 0,
    cropped: false,
    turned: 0,
    skybox: { source: null, sunIntensity: 1, environmentIntensity: 1, adjusted: false },
    channels: {},
    material: null,
  }
}

export function createFakeStudio(files: readonly StudioFile[]): FakeStudio {
  const refusals: string[] = []
  const bench: Bench = {
    files: files.map(one => ({ ...one })),
    documents: [],
    assets: files
      .filter(one => one.kind === 'file')
      .map((one, at) => ({
        // Off the same run of ids as everything else: minted apart, a generated asset landed on
        // the id of a project picture and `referenced` passed on the wrong one.
        id: `asset-${at + 1}`,
        name: pathBaseNameOf(one.path),
        // The one table that says what a file IS, rather than a copy of the suffix list.
        type: natureOf(one.path).domain,
        path: one.path,
        jobId: null,
        tags: [],
      })),
    jobs: [],
    // Nothing in front and no space chosen — the studio's own opening state, which `home` is not.
    space: null,
    frontId: null,
    selection: { kind: 'node', ids: [] },
    // Keyed by the families the REGISTRY declares — `3d`, never `model`, which `studio.state`
    // would otherwise advertise to the model as a family that does not exist.
    armed: { image: 'flux.1-dev', '3d': 'mesh-gen-1', video: 'video-gen-1' },
    prepared: null,
    past: [],
    future: [],
    projectName: 'Démo',
    git: blankGit(),
    shell: blankShell(),
    unmodelled: [],
    // Past the catalogue, so a generated asset can never mint the id of a project picture — it
    // did, and `referenced` then passed on a file nobody had pointed at.
    counter: files.length,
  }

  const open = (title: string, at: WorkspaceId, path: string | null): ActionOutcome => {
    const document = blankDocument(bench, title, at)
    document.path = path
    bench.documents.push(document)
    bench.space = at
    bench.frontId = document.id
    return answered({ documentId: document.id })
  }

  const openPath = (path: string, action: string): ActionOutcome => {
    const found = bench.files.find(one => one.path === path)
    if (!found) return refused('notFound')
    if (found.kind === 'folder') return refused('badInput')

    const already = bench.documents.find(one => one.path === path)
    if (already) {
      bench.frontId = already.id
      bench.space = already.space
      return done
    }

    const outcome = open(pathBaseNameOf(path), spaceOfFile(path), path)
    // The shape the real handler answers — an id is what the app never hands back here, and a
    // chain that leaned on one would pass on the bench and fail in the studio.
    return action === 'file.open' ? answered({ opened: 'document' }) : outcome
  }

  const core = (action: string, input: Input): ActionOutcome | null => {
    switch (action) {
      case 'studio.state':
        return answered({
          project: { name: bench.projectName },
          workspace: bench.space,
          selection: bench.selection,
          armedModels: bench.armed,
          documents: bench.documents.map(one => ({
            id: one.id,
            title: one.title,
            workspace: one.space,
            path: one.path,
            active: one.id === bench.frontId,
            modified: one.modified,
          })),
        })

      case 'file.open':
      case 'document.open':
        return openPath(text(input, 'path'), action)

      case 'workspace.open': {
        // Narrowed rather than checked: the door above already refused anything outside the list.
        const at = WORKSPACE_IDS.find(one => one === text(input, 'workspace'))
        if (!at) return refused('badInput')

        if (!flag(input, 'createDocument')) {
          bench.space = at
          // Bringing a space forward brings ITS document forward, as the rail does.
          bench.frontId = bench.documents.findLast(one => one.space === at)?.id ?? null
          return done
        }

        remember(bench)
        return open(text(input, 'title') || 'Sans titre', at, null)
      }

      case 'document.activate': {
        const named = text(input, 'documentId')
        const found =
          bench.documents.find(one => one.id === named) ??
          bench.documents.find(one => one.title === named) ??
          bench.documents.find(one => one.path === named)
        if (!found) return refused('notFound')

        bench.frontId = found.id
        bench.space = found.space
        return done
      }

      case 'document.close': {
        const named = text(input, 'documentId')
        const found = bench.documents.find(one => one.id === named || one.title === named)
        if (!found) return refused('notFound')

        bench.documents = bench.documents.filter(one => one !== found)
        if (bench.frontId === found.id) bench.frontId = bench.documents.at(-1)?.id ?? null
        return done
      }

      case 'target.select':
        bench.selection = { kind: text(input, 'kind') || 'node', ids: [text(input, 'targetId')] }
        return done

      case 'settings.write':
        return isRecord(input['settings']) ? done : refused('badInput')

      case 'settings.read':
        return answered({ three: { grid: true, shadows: false } })

      case 'chat.close':
        return done

      default:
        return null
    }
  }

  const run = (action: ActionName, input: Record<string, unknown>): ActionOutcome => {
    // The gate the real path holds before any handler runs — see `executor.ts`. Written by hand
    // per action, the bench let through every shape the studio refuses, and a call accepted at
    // fault reads exactly like a model that chose well.
    const declared = assistantAction(action)
    if (declared && !validatesInput(declared.fields, input)) return refused('badInput')

    // The refusal that cost a whole session to understand: an action of a space reaches nothing
    // unless a document of that space is the one in front.
    const needed = spaceNeededBy(action)
    if (needed && front(bench)?.space !== needed) return refused('wrongSurface')
    if (MONTAGE_PREFIXES.some(one => action.startsWith(one))) {
      const space = front(bench)?.space
      if (space !== 'video' && space !== 'audio') return refused('wrongSurface')
    }

    const answer =
      core(action, input) ??
      fileAction(bench, action, input) ??
      libraryAction(bench, action, input) ??
      sceneAction(bench, action, input) ??
      imageAction(bench, action, input) ??
      montageAction(bench, action, input) ??
      surfaceAction(bench, action, input) ??
      gitAction(bench, action, input) ??
      shellAction(bench, action, input) ??
      rigAction(bench, action, input)
    if (answer) return answer

    if (!bench.unmodelled.includes(action)) bench.unmodelled.push(action)
    return done
  }

  const watched = (action: ActionName, input: Record<string, unknown>): ActionOutcome => {
    const outcome = run(action, input)
    if (!outcome.ok) refusals.push(`${action} ${outcome.refusal}`)
    return outcome
  }

  const targets = (): readonly Target[] => {
    const open = front(bench)
    if (!open) return []

    const aimed = (kind: TargetKind, id: string, name: string): Target => ({
      id,
      kind,
      name,
      selected: bench.selection.ids.includes(id),
    })

    return [
      ...open.nodes.map(one => aimed('node', one.id, one.name)),
      ...open.layers.map(one => aimed('layer', one.id, one.name)),
      ...open.clips.map(one => aimed('clip', one.id, one.assetId)),
    ]
  }

  /** The sentences `describeStudio` writes. Withheld, they made section 2 unpassable here. */
  const inFront = (): string => {
    const shown = front(bench)
    if (shown) return `  In front: "${shown.title}" (${shown.space}).`

    // Not "no document is open", which the rule about making one would then act on.
    return bench.documents.length === 0
      ? '  In front: nothing. No document is open.'
      : '  In front: nothing — none of the open documents is active.'
  }

  const state = (): string => {
    const others = bench.documents.filter(one => one.id !== bench.frontId)
    return [
      'Studio now:',
      bench.space === null ? '  Space: none.' : `  Space: ${bench.space}.`,
      inFront(),
      ...(others.length > 0
        ? [`  Also open: ${others.map(one => `"${one.title}"`).join(', ')}.`]
        : []),
      `  Project: "${bench.projectName}".`,
    ].join('\n')
  }

  return {
    run: watched,
    state,
    targets,
    refusals: () => refusals,
    settle: () => {
      for (const one of bench.documents) one.modified = false
      bench.past = []
      bench.future = []
      refusals.length = 0
    },
    bench: () => bench,
    documents: () => bench.documents,
    front: () => front(bench) ?? null,
    unmodelled: () => bench.unmodelled,
  }
}
