import {
  assistantAction,
  validatesInput,
  type ActionName,
  type ActionOutcome,
} from '@shared/domain/assistant'
import { isRecord, readString } from '@shared/guards'
import { pathBaseNameOf } from '@shared/domain/fileName'
import { natureOf, type FileDomain } from '@shared/domain/fileRole'
import { MESH_ENTRIES, type TextureSlot } from '@shared/domain/scene'
import { WORKSPACE_IDS, type WorkspaceId } from '@shared/domain/workspace'
import { matchesWords, searchWords } from '@shared/text'

/**
 * A studio that answers like the real one without being one.
 *
 * The point of the bench is what the model CHOOSES, and choosing is decided by what each action
 * answers back — a search that finds nothing sends it somewhere else entirely. So this refuses
 * where the studio refuses, and answers the shapes the handlers answer.
 *
 * What it is NOT: the studio. Every engine, every store and every file is absent, and an action
 * it does not know answers `ok` with nothing — counted apart in the report, so a scenario is
 * never scored on a step nobody modelled.
 */
export type StudioFile = { path: string; kind: 'file' | 'folder' }

/**
 * `kind` because `node.sprite` refuses a node that is not one, and `textures` slot by slot: a
 * normal map is not a picture ON the plane, and one field for the two scored it as if it were.
 */
type SceneNode = {
  id: string
  name: string
  kind: string
  textures: Partial<Record<TextureSlot, string>>
  /** A sprite's own picture, which is not a material — see the oracle of the scene scenarios. */
  sprite: string | null
}

type StudioDocument = {
  id: string
  title: string
  space: WorkspaceId
  /** What a 3D document holds. Empty for every other kind, which is what the studio answers. */
  nodes: SceneNode[]
}

export type FakeStudio = {
  run: (action: ActionName, input: Record<string, unknown>) => ActionOutcome
  /** What the briefing tells the model the studio is, in the sentences `describeStudio` writes. */
  state: () => string
  documents: () => readonly StudioDocument[]
  front: () => StudioDocument | null
  /** Actions this studio has no answer for — a scenario is never judged on one of them. */
  unmodelled: () => readonly ActionName[]
}

/** The spaces whose actions need a document of their own kind in front. */
const SPACE_OF_ACTION: Partial<Record<string, WorkspaceId>> = {
  'node.': '3d',
  'scene.': '3d',
  'camera.': '3d',
  'layer.': 'image',
  'canvas.': 'image',
  'clip.': 'video',
  'skybox.': 'skyboxes',
  'channel.': 'textures',
}

const spaceNeededBy = (action: ActionName): WorkspaceId | null =>
  Object.entries(SPACE_OF_ACTION).find(([prefix]) => action.startsWith(prefix))?.[1] ?? null

const text = (input: Record<string, unknown>, key: string): string => readString(input, key, '')

const texts = (input: Record<string, unknown>, key: string): readonly string[] => {
  const value = input[key]
  return Array.isArray(value) ? value.filter(one => typeof one === 'string') : []
}

/** A file as the catalogue holds it: a `.png` on disk IS an asset, classed by its extension. */
type CatalogueAsset = { id: string; name: string; type: FileDomain; path: string }

const catalogueOf = (files: readonly StudioFile[]): readonly CatalogueAsset[] =>
  files
    .filter(one => one.kind === 'file')
    .map((one, index) => ({
      id: `asset-${index + 1}`,
      name: pathBaseNameOf(one.path),
      // The one table that says what a file IS, rather than a third copy of the suffix list.
      type: natureOf(one.path).domain,
      path: one.path,
    }))

/**
 * The other half of a node handler's refusal, which `validatesInput` does not carry: it answers
 * on a CHANGE and never on none — `editNode` returns `null` when nothing was named.
 */
const changes = (input: Record<string, unknown>, name: ActionName): boolean =>
  (assistantAction(name)?.fields ?? [])
    .filter(field => field.key !== 'nodeId')
    .some(field => input[field.key] !== undefined)

/**
 * The slots a material call names, as `texturesFrom` reads them: a record of SLOT to asset id,
 * never an `assetId` beside the node. `null` is the refusal — a value that is not a string.
 */
function slotsIn(input: Record<string, unknown>): Partial<Record<TextureSlot, string>> | null {
  const asked = input['textures']
  if (asked === undefined) return {}
  if (!isRecord(asked)) return null

  const slots: Partial<Record<TextureSlot, string>> = {}
  for (const [slot, value] of Object.entries(asked)) {
    if (typeof value !== 'string') return null
    // A blank id is the map taken OFF, which is not the same as leaving it alone.
    if (value.trim() !== '') slots[slot as TextureSlot] = value
  }

  return slots
}

const isMesh = (kind: string): boolean => MESH_ENTRIES.some(entry => entry.kind === kind)

/** What `node.material` reaches: a mesh or a text — and a text's outline takes no tiling. */
const wearsMaterial = (input: Record<string, unknown>, kind: string): boolean =>
  isMesh(kind) || (kind === 'text' && input['tilesPerMetre'] === undefined)

/** What space a file opens into — a `.glb` is a model, and the folder it sits in says nothing. */
const spaceOfFile = (path: string): WorkspaceId =>
  /\.(gltf|glb)$/i.test(path) ? '3d' : /\.(otio)$/i.test(path) ? 'video' : 'image'

export function createFakeStudio(files: readonly StudioFile[]): FakeStudio {
  const catalogue = catalogueOf(files)
  const documents: StudioDocument[] = []
  const unmodelled: ActionName[] = []
  // Nothing in front and no space chosen — the studio's own opening state, which `home` is not:
  // `WorkspaceId` holds the six that edit, and the rail's home is not one of them.
  let space: WorkspaceId | null = null
  let frontId: string | null = null
  let made = 0

  const front = (): StudioDocument | null => documents.find(one => one.id === frontId) ?? null

  const open = (title: string, at: WorkspaceId): ActionOutcome => {
    made += 1
    const document: StudioDocument = { id: `doc-${made}`, title, space: at, nodes: [] }
    documents.push(document)
    space = at
    frontId = document.id
    return { ok: true, data: { documentId: document.id } }
  }

  // By ID alone, as `nodeById` does — a bench answering to a NAME forgave the field the model
  // gets wrong most often. And the refusal is `badInput`: `editNode` never answers `notFound`.
  const nodeAimedBy = (input: Record<string, unknown>): SceneNode | undefined =>
    front()?.nodes.find(one => one.id === text(input, 'nodeId'))

  const added = (kind: string, name: string): ActionOutcome => {
    const scene = front()
    if (!scene) return { ok: false, refusal: 'wrongSurface' }

    made += 1
    const node = { id: `node-${made}`, name: name || 'Node', kind, textures: {}, sprite: null }
    scene.nodes.push(node)
    return { ok: true, data: { nodeId: node.id } }
  }

  const run = (action: ActionName, input: Record<string, unknown>): ActionOutcome => {
    // The gate the real path holds before any handler runs — see `executor.ts`. Written by hand
    // per action, the bench let through every shape the studio refuses, and a call accepted at
    // fault reads exactly like a model that chose well.
    const declared = assistantAction(action)
    if (declared && !validatesInput(declared.fields, input)) {
      return { ok: false, refusal: 'badInput' }
    }

    const needed = spaceNeededBy(action)
    // The refusal that cost a whole session to understand: an action of a space reaches nothing
    // unless a document of that space is the one in front.
    if (needed && front()?.space !== needed) return { ok: false, refusal: 'wrongSurface' }

    switch (action) {
      case 'files.search': {
        const words = searchWords(text(input, 'query'))
        return { ok: true, data: files.filter(one => matchesWords(one.path, words)) }
      }

      case 'files.list': {
        const folder = text(input, 'folder')
        return {
          ok: true,
          data: files.filter(one => (one.path.split('/').slice(0, -1).join('/') || '') === folder),
        }
      }

      case 'studio.state':
        return {
          ok: true,
          data: {
            workspace: space,
            documents: documents.map(one => ({
              id: one.id,
              title: one.title,
              workspace: one.space,
              active: one.id === frontId,
            })),
          },
        }

      case 'scene.state':
        return { ok: true, data: { nodes: front()?.nodes ?? [] } }

      case 'node.add':
        return added(text(input, 'kind'), text(input, 'name'))

      // Aims at a node rather than making one: it carries neither `kind` nor `name`, and a bench
      // that added a box here scored "resize the cube" as a second cube.
      case 'node.geometry': {
        const node = nodeAimedBy(input)
        return node && isMesh(node.kind) && changes(input, action)
          ? { ok: true }
          : { ok: false, refusal: 'badInput' }
      }

      // One of the three roads a picture or a mesh takes into a scene.
      case 'node.addModel':
        return added('model', text(input, 'name') || text(input, 'assetId'))

      // A sprite's map is set on a SPRITE, never on the plane a person asked for.
      case 'node.sprite': {
        const node = nodeAimedBy(input)
        if (node?.kind !== 'sprite' || !changes(input, action)) {
          return { ok: false, refusal: 'badInput' }
        }

        const map = text(input, 'map')
        if (map !== '') node.sprite = map
        return { ok: true }
      }

      case 'node.material': {
        const node = nodeAimedBy(input)
        // An imported model wears `model.textures`, never this one.
        if (!node || !wearsMaterial(input, node.kind) || !changes(input, action)) {
          return { ok: false, refusal: 'badInput' }
        }

        const slots = slotsIn(input)
        if (slots === null) return { ok: false, refusal: 'badInput' }

        node.textures = { ...node.textures, ...slots }
        return { ok: true }
      }

      // The library a material slot takes its id FROM: unmodelled, no id was ever reachable.
      case 'assets.search': {
        const words = searchWords(text(input, 'text'))
        const kind = text(input, 'type')
        return {
          ok: true,
          data: catalogue.filter(
            one =>
              (words.length === 0 || matchesWords(one.path, words)) &&
              (kind === '' || one.type === kind),
          ),
        }
      }

      case 'asset.get': {
        const wanted = texts(input, 'assetIds')
        return { ok: true, data: catalogue.filter(one => wanted.includes(one.id)) }
      }

      case 'documents.list':
        return { ok: true, data: documents.map(one => ({ id: one.id, title: one.title })) }

      // Both of them, because a model reaches for either: `document.open` is what the registry
      // publishes for a document by path, and `file.open` for anything the folder holds.
      case 'file.open':
      case 'document.open': {
        const found = files.find(one => one.path === text(input, 'path'))
        if (!found) return { ok: false, refusal: 'notFound' }
        if (found.kind === 'folder') return { ok: false, refusal: 'badInput' }

        const opened = open(found.path.split('/').pop() ?? found.path, spaceOfFile(found.path))
        // The shape the real handler answers — an id is what the app never hands back here, and
        // a chain that leaned on one would pass on the bench and fail in the studio.
        return opened.ok && action === 'file.open'
          ? { ok: true, data: { opened: 'document' } }
          : opened
      }

      case 'workspace.open': {
        // Narrowed rather than checked: the door above already refused anything outside the list.
        const at = WORKSPACE_IDS.find(one => one === text(input, 'workspace'))
        if (!at) return { ok: false, refusal: 'badInput' }

        if (input['createDocument'] !== true) {
          space = at
          return { ok: true }
        }

        return open(text(input, 'title') || 'Sans titre', at)
      }

      case 'document.activate': {
        const named = text(input, 'documentId')
        const found =
          documents.find(one => one.id === named) ??
          documents.filter(one => one.title === named).at(0)
        if (!found) return { ok: false, refusal: 'notFound' }

        frontId = found.id
        space = found.space
        return { ok: true }
      }

      default:
        if (!unmodelled.includes(action)) unmodelled.push(action)
        return { ok: true }
    }
  }

  return {
    run,
    documents: () => documents,
    front,
    unmodelled: () => unmodelled,
    /**
     * The sentences `describeStudio` writes, names included. Withheld, they made scenario 2 — a
     * document named almost exactly as the person said it — a case the bench could not pass and
     * the app could.
     */
    state: () => {
      const shown = front()
      const others = documents.filter(one => one.id !== shown?.id)
      return [
        'Studio now:',
        space === null ? '  Space: none.' : `  Space: ${space}.`,
        shown
          ? `  In front: "${shown.title}" (${shown.space}).`
          : documents.length === 0
            ? '  In front: nothing. No document is open.'
            : '  In front: nothing — none of the open documents is active.',
        ...(others.length > 0
          ? [`  Also open: ${others.map(one => `"${one.title}"`).join(', ')}.`]
          : []),
      ].join('\n')
    },
  }
}
