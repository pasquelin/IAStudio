import { mdiFolderOpenOutline, mdiImageMultipleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { intentsFor } from '@/helpers/asset-intents'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useAssets } from '@/stores/assets'

export type AssetMenuProps = {
  asset: Asset
  at: { x: number; y: number }
  onClose: () => void
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
 * A destination whose space has no document open is shown disabled rather than hidden: a menu
 * that changes length depending on what is open is a menu one cannot learn.
 */
export function AssetMenu({ asset, at, onClose }: AssetMenuProps) {
  const { t } = useTranslation()

  const choose =
    (run: () => void): (() => void) =>
    () => {
      run()
      onClose()
    }

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

  return (
    <ContextMenu at={at} onClose={onClose}>
      {intentsFor(asset.type).map(intent => (
        <MenuRow
          key={intent.id}
          label={t(intent.labelKey)}
          // Read off the workspace table: changing a space's glyph in the rail must change it here.
          icon={workspaceById(intent.workspace).icon}
          disabled={!intent.ready(asset)}
          tip={HINT_RIGHT(t(`${intent.labelKey}Hint`))}
          onSelect={choose(() => void intent.run(asset))}
        />
      ))}
      {/* Only for a mesh, because only a mesh keeps its pictures inside itself. Shown for one
          wherever it sits and disabled when the file is not here — a row that appears and
          disappears with the selection is a row nobody can learn. */}
      {asset.type === 'mesh' && (
        <MenuRow
          label={t('assets.extractTextures')}
          icon={mdiImageMultipleOutline}
          disabled={asset.location !== 'local'}
          tip={HINT_RIGHT(t('assets.extractTexturesHint'))}
          onSelect={choose(extract)}
        />
      )}
      <MenuRow
        label={t('inspector.reveal')}
        icon={mdiFolderOpenOutline}
        disabled={asset.location !== 'local'}
        tip={HINT_RIGHT(t('inspector.revealHint'))}
        onSelect={choose(reveal)}
      />
    </ContextMenu>
  )
}
