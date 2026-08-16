import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { getBridge } from '@/services/bridge'
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
      if (failure) reportFailure('assets.rename', name, new Error(failure))
    })
}

/**
 * The same rename, reached from a PATH — the explorer, which shows files rather than rows.
 *
 * It goes through the asset's own channel and not through `project.renameFile`, which the main
 * process refuses under `assets/` (`isStudioOwned`). One name now stands for the row and its
 * file both, so there is one gesture that may write it, and this is how a panel holding a path
 * reaches it: the catalogue is asked which asset sits there, the same question the double-click
 * already asks to open one.
 *
 * `name` is a stem, without the extension the explorer draws: the suffix follows the bytes, and
 * a name carrying one would grow a second on the next rename — `Ruelle.png.png`.
 */
export function renameAssetAt(path: string, name: string): void {
  void getBridge()
    ?.assets.search({ path, limit: 1 })
    .then(([asset]) => {
      // Nothing in the catalogue at that path: a file somebody dropped into `assets/` by hand
      // is not an asset, and the studio has no row to rename. Said out loud rather than
      // silently doing nothing — the field has closed by now, so the journal is all there is.
      if (!asset) return reportFailure('assets.rename', name, new Error('asset-not-found'))

      renameAsset(asset.id, asset.name, name)
    })
    .catch((error: unknown) => reportFailure('assets.rename', name, error))
}
