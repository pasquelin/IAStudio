import { orElse } from '@shared/promises'
import {
  kindForWorkspace,
  DOCUMENTS_FOLDER,
  type DocumentDescriptor,
} from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { parentOf } from '@shared/domain/folder'
import { DEFAULT_SCENE_TEMPLATE, type SceneTemplateId } from '@shared/domain/sceneTemplate'
import { ensureCheckerTextures } from '@/engines/scene/checkerTextures'
import { seedSceneTemplate } from '@/stores/scenes'
import { takenDocumentNames, untitledDocumentName, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { getBridge } from '@/services/bridge'
import { openDocument } from './dockviewApi'

/**
 * Where the field opens: the folder the Explorer is pointing at, or `DOCUMENTS_FOLDER` when it
 * points at nothing. A row that is a FILE means the folder holding it — what is on screen around
 * the selection is what the user is looking at, whichever row carries the highlight.
 *
 * The disk is asked which of the two it is: a path alone cannot say, and a folder mistaken for a
 * file would open the field one level too high.
 */
async function startingFolder(): Promise<string> {
  const picked = selectedFilePaths(useSelection.getState()).at(-1)
  if (picked === undefined) return DOCUMENTS_FOLDER

  const facts = await orElse(getBridge()?.project.fileFacts(picked), null)
  if (!facts) return DOCUMENTS_FOLDER

  return facts.kind === 'folder' ? picked : (parentOf(picked) ?? DOCUMENTS_FOLDER)
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
type NamedCreation = { title: string; folder?: string; template?: SceneTemplateId }

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

    const folder = await startingFolder()
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
