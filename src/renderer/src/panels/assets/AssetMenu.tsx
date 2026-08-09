import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { intentsFor } from '@/helpers/asset-intents'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'

export type AssetMenuProps = {
  asset: Asset
  at: { x: number; y: number }
  onClose: () => void
}

/**
 * What can be done with an asset, listed rather than guessed.
 *
 * Every destination comes from `ASSET_INTENTS` — the same table the double-click walks. That is
 * the whole point of the table existing: before it, where an asset could go was knowledge locked
 * inside one `if` chain, so double-clicking was the only gesture that could send one anywhere.
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

  return (
    <ContextMenu at={at} onClose={onClose}>
      {intentsFor(asset.type).map(intent => (
        <MenuRow
          key={intent.id}
          label={t(intent.labelKey)}
          // Read off the workspace table: changing a space's glyph in the rail must change it here.
          icon={workspaceById(intent.workspace).icon}
          disabled={!intent.ready(asset)}
          onSelect={choose(() => void intent.run(asset))}
        />
      ))}
      <MenuRow
        label={t('inspector.reveal')}
        icon={mdiFolderOpenOutline}
        disabled={asset.location !== 'local'}
        onSelect={choose(reveal)}
      />
    </ContextMenu>
  )
}
