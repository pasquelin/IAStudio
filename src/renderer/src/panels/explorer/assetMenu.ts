import {
  mdiCloudUploadOutline,
  mdiFileDocumentOutline,
  mdiImageMultipleOutline,
  mdiSendOutline,
  mdiShapeOutline,
  mdiTextBoxOutline,
} from '@mdi/js'
import type { TFunction } from 'i18next'
import type { Asset } from '@shared/domain/asset'
import { intentsFor, pixelEditorIntent } from '@/helpers/assetIntents'
import type { ContextMenuAction, ContextMenuRow } from '@/helpers/contextMenu'
import { openAsset } from '@/helpers/openAsset'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useAssets } from '@/stores/assets'
import type { AssetAction } from './assetActions'

export type AssetMenuProps = {
  /** The asset the clicked row is, or nothing when the catalogue holds none at its path. */
  asset: Asset | null
  /** How many rows of the selection could carry a catalogue gesture — see `runAssetAction`. */
  count: number
  /**
   * Handed the translator rather than the words, and it is the one menu that needs to be: its
   * rows come from `ASSET_INTENTS`, whose labels are keys the table carries. A host composing
   * them itself would be a second copy of the table.
   */
  t: TFunction
  /** Runs one of the three gestures over the selection — the explorer owns the paths. */
  onAsset: (action: AssetAction) => void
}

/**
 * What can be done with an asset, listed rather than guessed — two groups on the explorer's menu.
 *
 * 🛑 Groups and not rows: this menu already offers twelve gestures about the FILE, and flattening
 * ten more into it made a list nobody could read. Destinations come from `ASSET_INTENTS`.
 */
export function assetMenuGroups({ asset, count, t, onAsset }: AssetMenuProps): ContextMenuRow[] {
  return [{ separator: true }, sendGroup(asset, t), catalogueGroup(asset, count, t, onAsset)]
}

/** Sending it into a document already open — a gesture of its own, not a fallback of opening. */
function sendGroup(asset: Asset | null, t: TFunction): ContextMenuRow {
  const pixels = asset && pixelEditorIntent(asset)

  const rows: ContextMenuAction[] = asset
    ? intentsFor(asset.type).map(intent => ({
        label: t(intent.labelKey),
        // Read off the workspace table: changing a space's glyph in the rail must change it here.
        icon: workspaceById(intent.workspace).icon,
        tooltip: t(`${intent.labelKey}Hint`),
        disabled: !intent.ready(asset),
        onSelect: () => void intent.run(asset),
      }))
    : []

  // The other half of extracting a model's textures: a channel is assembled in the Textures
  // space, which writes no image back, so this is where its pixels are opened for editing.
  if (asset && pixels) {
    rows.push({
      label: t('assets.editPixels'),
      icon: workspaceById(pixels.workspace).icon,
      tooltip: t('assets.editPixelsHint'),
      onSelect: () => void openAsset(asset, pixels),
    })
  }

  return {
    label: t('assets.sendTo'),
    icon: mdiSendOutline,
    tooltip: t('assets.sendToHint'),
    // A row the catalogue holds nothing for has nowhere to send anything, and an empty submenu
    // is a promise that opens onto nothing.
    disabled: rows.length === 0,
    rows,
  }
}

/** What is done to the catalogue rows themselves, over the whole selection where it applies. */
function catalogueGroup(
  asset: Asset | null,
  count: number,
  t: TFunction,
  onAsset: (action: AssetAction) => void,
): ContextMenuRow {
  const rows: ContextMenuAction[] = [
    {
      label: t('assets.describe', { count }),
      tooltip: t('assets.describeHint'),
      icon: mdiTextBoxOutline,
      disabled: count === 0,
      onSelect: () => onAsset('describe'),
    },
    {
      label: t('assets.contactSheet', { count }),
      tooltip: t('assets.contactSheetHint'),
      icon: mdiFileDocumentOutline,
      disabled: count === 0,
      onSelect: () => onAsset('contactSheet'),
    },
    {
      label: t('assets.push', { count }),
      tooltip: t('assets.pushHint'),
      icon: mdiCloudUploadOutline,
      disabled: count === 0,
      onSelect: () => onAsset('push'),
    },
  ]

  // Only for a mesh, because only a mesh keeps its pictures inside itself. Greyed when the file
  // is not here — a row that appears and disappears with the selection is one nobody can learn.
  if (asset?.type === 'mesh') {
    rows.push({
      label: t('assets.extractTextures'),
      icon: mdiImageMultipleOutline,
      tooltip: t('assets.extractTexturesHint'),
      disabled: asset.location !== 'local',
      onSelect: () => extractTextures(asset),
    })
  }

  return {
    label: t('assets.catalogueGroup'),
    icon: mdiShapeOutline,
    tooltip: t('assets.catalogueGroupHint'),
    rows,
  }
}

/**
 * The model's own pictures, taken out into the project. The catalogue is told to re-read rather
 * than handed the new rows: the same invalidation every other write goes through, so what is on
 * screen comes from the catalogue and never from what a gesture believed it created.
 */
function extractTextures(asset: Asset): void {
  void getBridge()
    ?.assets.extractTextures(asset.id)
    .catch(error => reportFailure('assets.extract', asset.name, error))
    // In `finally`, because the write is not all-or-nothing: the handler files one picture at a
    // time, so a failure on the fourth leaves three in the catalogue — invisible until some
    // unrelated refresh, if only the happy path re-read the shelf.
    .finally(() => useAssets.getState().invalidate())
}
