import type { Asset } from '@shared/domain/asset'
import type { WorkspaceId } from '@shared/domain/workspace'
import { createDocumentIn } from '@/app/new-document'
import { useLayouts } from '@/stores/layouts'

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
 * Opens an asset from a shelf. `openAsset` does the whole of it; what this adds is WHEN it is
 * loaded.
 *
 * Deferred to the click rather than resolved at mount: `openAsset` reads `ASSET_INTENTS`, which
 * reaches into every editor's folder to know where a sound or a channel lands. Imported at the
 * top of a shelf it drags the audio loader and the texture placer into the opening chunk, which
 * `eager-graph.test.ts` holds a budget on — the home is the first screen, and it must not
 * evaluate an editor to draw a grid of stills.
 */
export async function openFromHome(asset: Asset): Promise<void> {
  const { openAsset } = await import('@/helpers/open-asset')
  await openAsset(asset)
}
