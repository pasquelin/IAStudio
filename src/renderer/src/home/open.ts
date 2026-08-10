import type { Asset } from '@shared/domain/asset'
import { workspaceOfType } from '@shared/domain/asset-kind'
import type { WorkspaceId } from '@shared/domain/workspace'
import { openDocument } from '@/app/dockview-api'
import { createDocumentIn } from '@/app/new-document'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'

/**
 * Leaves the home for a workspace, on a blank document when there is a project to write one in.
 *
 * Opening a document that already exists needs nothing of its own: `openDocument` switches to
 * whichever workspace owns it and queues the panel until that Dockview reports itself — which
 * is exactly the gap the home opens by covering the centre.
 */
export function enterWorkspace(workspace: WorkspaceId): void {
  useLayouts.getState().setActiveWorkspace(workspace)
  createDocumentIn(workspace)
}

/**
 * Opens an asset from a shelf, making the document it needs when there is none.
 *
 * That second half is what makes the gesture keep its word HERE and not elsewhere: the cascade
 * only ever sends an asset into a document already open, and the home is on screen precisely
 * when none is. Left to `openAsset` alone, a click on a fresh home would journal "no
 * destination" and paint nothing — the very complaint this gesture answers.
 *
 * Loaded on the click rather than at mount: `openAsset` reads `ASSET_INTENTS`, which reaches
 * into every editor's folder to know where a sound or a channel lands. Imported at the top of a
 * band it drags the audio loader and the texture placer into the opening chunk, which
 * `eager-graph.test.ts` holds a budget on.
 */
export async function openFromHome(asset: Asset): Promise<void> {
  const { defaultIntent } = await import('@/helpers/asset-intents')
  const { openAsset } = await import('@/helpers/open-asset')

  // The project guard is `createDocumentIn`'s, and it is needed here for the same reason: a
  // document is a file in a folder, and `create` alone would post a descriptor for a tab that
  // has nowhere to be saved. `openAsset` then says the asset has nowhere to go, as it does for
  // any other — one silence, not two.
  if (!defaultIntent(asset) && useProject.getState().project) {
    const workspace = workspaceOfType(asset.type)
    useLayouts.getState().setActiveWorkspace(workspace)
    const created = await useDocuments.getState().create(workspace)
    if (created) openDocument(created)
  }

  await openAsset(asset)
}
