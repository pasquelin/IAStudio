import { kindForWorkspace } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import { takenDocumentNames, untitledDocumentName, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { mountedDocumentNamer } from './document-name'
import { openDocument } from './dockview-api'

/**
 * Makes a document in a workspace, on the name its author gives it, and puts it in front.
 *
 * Its own file because three surfaces ask for it — the rail's plus button, the home's tools and
 * the assistant — and the copies had already started to differ. Deliberately away from
 * `document-io`, which reaches every engine: the rail must not import three megabytes to open an
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
  let of: { title: string } | undefined

  if (ask) {
    // The folder first, and this is the only place it is read for a creation: what it holds is
    // both what the field proposes and what it refuses.
    await useDocuments.getState().relist()

    const taken = takenDocumentNames(useDocuments.getState())
    const title = await ask({ kind, suggested: untitledDocumentName(taken, kind), taken })
    // Called off. Nothing is made — no tab, no file — which is what cancelling has to mean.
    if (title === null) return

    of = { title }
  }

  const created = await useDocuments.getState().create(workspace, of)
  if (created) openDocument(created)
}
