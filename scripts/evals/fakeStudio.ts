import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
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

type SceneNode = { id: string; name: string; material: string | null }

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

const text = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === 'string' ? input[key] : ''

/** What space a file opens into — a `.glb` is a model, and the folder it sits in says nothing. */
const spaceOfFile = (path: string): WorkspaceId =>
  /\.(gltf|glb)$/i.test(path) ? '3d' : /\.(otio)$/i.test(path) ? 'video' : 'image'

export function createFakeStudio(files: readonly StudioFile[]): FakeStudio {
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

  const run = (action: ActionName, input: Record<string, unknown>): ActionOutcome => {
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
      case 'node.geometry': {
        const scene = front()
        if (!scene) return { ok: false, refusal: 'wrongSurface' }

        made += 1
        const node = { id: `node-${made}`, name: text(input, 'name') || 'Node', material: null }
        scene.nodes.push(node)
        return { ok: true, data: { nodeId: node.id } }
      }

      case 'node.material': {
        const scene = front()
        const named = text(input, 'nodeId')
        const node = scene?.nodes.find(one => one.id === named || one.name === named)
        if (!node) return { ok: false, refusal: 'notFound' }

        // What makes a plane carry a picture: an asset id, or the path of one.
        const picture = text(input, 'assetId') || text(input, 'map') || text(input, 'colorMap')
        if (picture === '') return { ok: false, refusal: 'badInput' }

        node.material = picture
        return { ok: true }
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
        // Checked against the real list, as `openWorkspace` does: a model answering "3D" or
        // "scene" is refused there, and a bench that accepted it would score a document into a
        // space that cannot exist and blame the model for the miss.
        const named = text(input, 'workspace')
        const at = WORKSPACE_IDS.find(one => one === named)
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
