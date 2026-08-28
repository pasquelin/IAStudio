import { orElse } from '@shared/promises'
import {
  kindForWorkspace,
  roleForKind,
  type DocumentDescriptor,
  type DocumentKind,
} from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { documentPathFor } from '@shared/domain/documentName'
import { parentOf } from '@shared/domain/folder'
import { DEFAULT_ROLE_PATHS } from '@shared/domain/folderRole'
import { SCRIPT_STARTER } from '@shared/domain/game'
import { DEFAULT_SCENE_TEMPLATE, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { ensureCheckerTextures } from '@/engines/scene/checkerTextures'
import { seedSceneTemplate } from '@/stores/scenes'
import {
  documentAtPath,
  takenDocumentNames,
  untitledDocumentName,
  useDocuments,
} from '@/stores/documents'
import { useProject } from '@/stores/project'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { getBridge } from '@/services/bridge'
import { openDocument } from './dockviewApi'

/**
 * The file first, then the tab: `relist` is what gives the document the id its path spells.
 *
 * Exported for the one other thing that makes a script — a generation, which brings its own
 * source where a person's gesture brings the starter.
 */
export async function createScript(
  of: NamedCreation | undefined,
  source: string = SCRIPT_STARTER,
): Promise<DocumentDescriptor | null> {
  if (!of) return null

  // Composed like every other kind: from the RAW title, a separator named a file in another
  // folder, and a name the main process refuses made `writeScript` answer `false` — nothing on
  // screen, no word.
  const path = documentPathFor(of.title, 'script', of.folder)
  // Refused rather than overwritten: this path names a file somebody already has work in.
  if (documentAtPath(useDocuments.getState(), path)) return null
  if (!(await orElse(getBridge()?.game.writeScript(path, source), false))) return null

  await useDocuments.getState().relist()
  const created = documentAtPath(useDocuments.getState(), path)
  if (created) openDocument(created)
  return created
}

/**
 * Where the field opens: the folder the Explorer is pointing at, or this kind's own when it
 * points at nothing. A row that is a FILE means the folder holding it — what is on screen around
 * the selection is what the user is looking at, whichever row carries the highlight.
 *
 * The disk is asked which of the two it is: a path alone cannot say, and a folder mistaken for a
 * file would open the field one level too high.
 */
async function startingFolder(kind: DocumentKind): Promise<string> {
  // ASKED, never composed: only the main process reads the markers, so only it knows where a
  // role went after a rename in the Finder — and asking is what lays the folder back down.
  const own = await orElse(
    getBridge()?.project.folderFor(roleForKind(kind)),
    DEFAULT_ROLE_PATHS[roleForKind(kind)],
  )

  const picked = selectedFilePaths(useSelection.getState()).at(-1)
  if (picked === undefined) return own

  const facts = await orElse(getBridge()?.project.fileFacts(picked), null)
  if (!facts) return own

  return facts.kind === 'folder' ? picked : (parentOf(picked) ?? own)
}

/**
 * Makes a document in a workspace, on the name and in the folder its author gives it, and puts
 * it in front.
 *
 * Its own file because three surfaces ask for it — the rail's plus button, the home's tools and
 * the assistant — and the copies had already started to differ. Deliberately away from
 * `documentIo`, which reaches every engine: the rail must not import three megabytes to open an
 * empty canvas.
 *
 * A folder gone read-only, or removed under us, leaves the workspace empty rather than failing
 * loudly: that is the honest outcome on screen, and the studio has nowhere to say more until it
 * grows a notification.
 *
 * It ANSWERS all the same — `null` for a field called off, a folder that refused, a workspace
 * with no documents. A caller from outside the window is held on the other end of this.
 */
export function createDocumentIn(
  workspace: WorkspaceId,
  called?: NamedCreation,
): Promise<DocumentDescriptor | null> {
  return named(workspace, called).catch(() => null)
}

/**
 * What a caller who has nobody to ask already knows. `template` is read for a scene and ignored
 * everywhere else — the assistant names one, and a caller that says nothing takes the default.
 */
export type NamedCreation = { title: string; folder?: string; template?: SceneTemplateId }

async function named(
  workspace: WorkspaceId,
  called?: NamedCreation,
): Promise<DocumentDescriptor | null> {
  const kind = kindForWorkspace(workspace)
  if (kind === null || !useProject.getState().project) return null

  // Started here and awaited far below: the install is a round trip to the main process, and it
  // has the naming window and the creation to run under rather than after.
  const textures =
    kind === 'scene'
      ? ensureCheckerTextures(useProject.getState().project?.path ?? '')
      : Promise.resolve()

  // Already named: no window is opened at all. There is nothing left to ask, and asking would
  // hold a caller outside the window on a question only the person in front of it can answer.
  const namer = called ? null : getBridge()?.newDocument
  let of: NamedCreation | undefined = called

  if (namer) {
    // The folders first: what they hold is what the suggested name has to step over.
    await useDocuments.getState().relist()

    const folder = await startingFolder(kind)
    const state = useDocuments.getState()

    const place = await namer.ask({
      kind,
      folder,
      suggested: untitledDocumentName(takenDocumentNames(state, folder), kind),
      projectName: useProject.getState().project?.manifest.name ?? '',
      // The tabs, which the window cannot read: it lists the project FOLDER for itself, and a
      // document opened and never saved is in no folder to be found.
      open: Object.values(state.documents),
    })
    // Called off — the window was closed, or Cancel was pressed. Nothing is made, no tab and no
    // file, which is what cancelling has to mean.
    if (place === null) return null

    of = place
  }

  // 🛑 A script is written BEFORE it has a tab, and no other kind is: nothing in a `.ts` can
  // carry an id, so the file's own path IS the document's identity — a tab opened under a fresh
  // uuid would never find its file again, and every save would write a new one beside it.
  if (kind === 'script') return await createScript(of)

  const created = await useDocuments.getState().create(workspace, of)
  if (!created) return null

  // Before the tab opens, and that order is the whole mechanism: `restoreDocument` puts the
  // studio default in a document that holds nothing, and holding the template's scene already is
  // what stops it.
  if (created.kind === 'scene') {
    // AWAITED, and this is the only place it can be: a template lays its shapes down before any
    // editor mounts, so the hook that installs the working textures has not run — every shape of
    // the first 3D document of a session was born bare, and saved that way for good.
    await textures
    seedSceneTemplate(created.id, of?.template ?? DEFAULT_SCENE_TEMPLATE)
  }

  openDocument(created)
  return created
}
