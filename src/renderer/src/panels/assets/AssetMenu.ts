import { mdiFolderOpenOutline, mdiImageMultipleOutline, mdiRenameOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import type { Asset } from '@shared/domain/asset'
import { intentsFor, pixelEditorIntent } from '@/helpers/asset-intents'
import { showContextMenu, type ContextMenuRow } from '@/helpers/context-menu'
import { openAsset } from '@/helpers/open-asset'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useAssets } from '@/stores/assets'

export type AssetMenuProps = {
  asset: Asset
  /**
   * Handed the translator rather than the words, and it is the one menu that needs to be: its
   * rows come from `ASSET_INTENTS`, whose labels are keys the table carries. A host composing
   * them itself would be a second copy of the table.
   */
  t: TFunction
  /**
   * Opens the name for editing where it is read. Absent for a host that draws no name — a job
   * still generating has a tile and no row of its own to rename.
   */
  onRename?: () => void
}

/**
 * What can be done with an asset, listed rather than guessed.
 *
 * Every destination comes from `ASSET_INTENTS`, and this menu is what the table is FOR: before
 * it, where an asset could go was knowledge locked inside one `if` chain, so double-clicking was
 * the only gesture that could send one anywhere.
 *
 * The double-click no longer walks it at all — it opens the asset in its own editor
 * (`editorIntent`). What this lists is the other half: sending an asset into a document already
 * open, which is a gesture of its own and not a fallback of that one.
 *
 * A destination whose space has no document open is greyed rather than dropped: a menu that
 * changes length depending on what is open is a menu one cannot learn.
 */
export function openAssetMenu({ asset, t, onRename }: AssetMenuProps): void {
  const pixels = pixelEditorIntent(asset)

  // The inspector turns a false into a "file missing" row; this menu is gone by the time the
  // answer comes, so the failure travels to the log rather than nowhere. Either way, never a
  // row that silently does nothing.
  const reveal = (): void => {
    void getBridge()
      ?.assets.reveal(asset.id)
      .then(shown => {
        if (!shown) reportFailure('assets.reveal', asset.name, new Error('file not found'))
      })
      .catch(error => reportFailure('assets.reveal', asset.name, error))
  }

  /**
   * The model's own pictures, taken out into the project. The shelf is told to re-read rather
   * than handed the new rows: the same invalidation every other write goes through, so what is
   * on screen comes from the catalogue and never from what a gesture believed it created.
   */
  const extract = (): void => {
    void getBridge()
      ?.assets.extractTextures(asset.id)
      .catch(error => reportFailure('assets.extract', asset.name, error))
      // In `finally`, because the write is not all-or-nothing: the handler files one picture at
      // a time, so a failure on the fourth leaves three in the catalogue — invisible until some
      // unrelated refresh, if only the happy path re-read the shelf.
      .finally(() => useAssets.getState().invalidate())
  }

  const rows: ContextMenuRow[] = intentsFor(asset.type).map(intent => ({
    label: t(intent.labelKey),
    // Read off the workspace table: changing a space's glyph in the rail must change it here.
    icon: workspaceById(intent.workspace).icon,
    tooltip: t(`${intent.labelKey}Hint`),
    disabled: !intent.ready(asset),
    onSelect: () => void intent.run(asset),
  }))

  // The other half of extracting a model's textures: a channel is assembled in the Textures
  // space, which writes no image back, so this is where its pixels are opened for editing.
  if (pixels) {
    rows.push({
      label: t('assets.editPixels'),
      icon: workspaceById(pixels.workspace).icon,
      tooltip: t('assets.editPixelsHint'),
      onSelect: () => void openAsset(asset, pixels),
    })
  }

  // Only for a mesh, because only a mesh keeps its pictures inside itself. Shown for one
  // wherever it sits and greyed when the file is not here — a row that appears and disappears
  // with the selection is a row nobody can learn.
  if (asset.type === 'mesh') {
    rows.push({
      label: t('assets.extractTextures'),
      icon: mdiImageMultipleOutline,
      tooltip: t('assets.extractTexturesHint'),
      disabled: asset.location !== 'local',
      onSelect: extract,
    })
  }

  // Handed back to the host rather than commanded here, exactly as the layer menu does: the
  // field belongs to the tile the name is read on, and this menu is gone by the time it opens.
  // Absent for a library asset and for a job: the name renamed is the one in THIS project's
  // catalogue, and neither has a row there yet.
  if (onRename) {
    rows.push({
      label: t('assets.rename'),
      icon: mdiRenameOutline,
      tooltip: t('assets.renameHint'),
      onSelect: onRename,
    })
  }

  rows.push({
    label: t('inspector.reveal'),
    icon: mdiFolderOpenOutline,
    tooltip: t('inspector.revealHint'),
    disabled: asset.location !== 'local',
    onSelect: reveal,
  })

  void showContextMenu(rows)
}
