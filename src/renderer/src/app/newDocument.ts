import { kindForWorkspace, DOCUMENTS_FOLDER } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { parentOf } from '@shared/domain/folder'
import { takenDocumentNames, untitledDocumentName, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { getBridge } from '@/services/bridge'
import { mountedDocumentNamer } from './documentName'
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

  const facts = await getBridge()
    ?.project.fileFacts(picked)
    .catch(() => null)
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
 * loudly: that is the honest outcome, and the studio has nowhere to say more until it grows a
 * notification.
 */
export function createDocumentIn(workspace: WorkspaceId): void {
  void named(workspace).catch(() => {})
}

async function named(workspace: WorkspaceId): Promise<void> {
  const kind = kindForWorkspace(workspace)
  if (kind === null || !useProject.getState().project) return

  const ask = mountedDocumentNamer()
  let of: { title: string; folder: string } | undefined

  if (ask) {
    // The folders first, and this is the only place they are read for a creation: what they hold
    // is both what the name field proposes and what it refuses.
    await useDocuments.getState().relist()

    const folder = await startingFolder()
    const takenIn = (asked: string): ReturnType<typeof takenDocumentNames> =>
      takenDocumentNames(useDocuments.getState(), asked)

    const place = await ask({
      kind,
      folder,
      suggested: untitledDocumentName(takenIn(folder), kind),
      takenIn,
    })
    // Called off. Nothing is made — no tab, no file — which is what cancelling has to mean.
    if (place === null) return

    of = place
  }

  const created = await useDocuments.getState().create(workspace, of)
  if (created) openDocument(created)
}
