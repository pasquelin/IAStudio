import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { reportFailure } from '@/services/diagnostics'

/**
 * Renaming, from wherever a name is read — and saying so when it did not take.
 *
 * The four hosts of a document's name and the two of an asset's each had the same three lines:
 * compare against the old name, call the store, drop the answer on the floor. The last of those
 * was a defect — a name already taken, or one holding a separator, closed the field and reported
 * nothing anywhere.
 *
 * The journal and not the screen, because of WHEN the answer comes: `InlineRename` commits on
 * blur as much as on Enter, so the field is gone before the disk has replied. The activity list
 * is where the studio says what a gesture could not do.
 *
 * A name equal to the old one is not a rename: `InlineRename` gives the original back when the
 * edit was abandoned, and writing then would be a round trip for nothing.
 */
export function renameDocument(documentId: string, was: string, name: string): void {
  if (name === was) return

  void useDocuments
    .getState()
    .rename(documentId, name)
    .then(failure => {
      if (failure) reportFailure('document.rename', name, new Error(failure))
    })
}

export function renameAsset(assetId: string, was: string, name: string): void {
  if (name === was) return

  void useAssets
    .getState()
    .rename(assetId, name)
    .then(failure => {
      if (failure) return reportFailure('assets.rename', name, new Error(failure))

      renameDocumentsOfAsset(assetId, name)
    })
}

/**
 * The tabs editing this asset take its new name too.
 *
 * A document opened FROM an asset is called after it — `openAsset` copies the name across when
 * the tab is created — and nothing carried a later rename over: the shelf said « squelette »
 * while the tab above it still read `asset_UjmhYgPhewvzGCx2tD1jxvwL`, which is the two-name
 * problem back in the one place a user cannot miss it.
 *
 * All of them, not the first: one asset is legitimately edited by two documents — a texture is a
 * channel in the Textures space and pixels in the Images one.
 *
 * A document keeps its OWN name once somebody types one; this only follows the asset because the
 * asset is where the name came from. Renaming the tab does not travel back the other way — a
 * montage of layers is not its source picture, and one gesture writing two things is one gesture
 * too many.
 *
 * Failures land in the journal per document rather than undoing the asset's rename: the asset is
 * what was asked for, and a tab whose name did not follow is a smaller wrong than a rename that
 * silently did not happen.
 */
function renameDocumentsOfAsset(assetId: string, name: string): void {
  const { documents, stored } = useDocuments.getState()

  // Closed ones too, and by id so an open document listed in both is renamed once. A document
  // saved for an asset and then closed lives only in the folder listing: leaving it behind would
  // hand the old name back the day it is reopened, which is the same defect on a delay.
  const byId = new Map([...stored, ...Object.values(documents)].map(entry => [entry.id, entry]))

  for (const document of byId.values()) {
    if (document.sourceAssetId === assetId) renameDocument(document.id, document.title, name)
  }
}
