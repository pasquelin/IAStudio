import { mdiFolderOpenOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { intentsFor } from '@/helpers/asset-intents'
import { getBridge } from '@/services/bridge'

export type AssetMenuProps = {
  asset: Asset
  at: { x: number; y: number }
  onClose: () => void
}

/**
 * What can be done with an asset, listed rather than guessed.
 *
 * Every destination comes from `ASSET_INTENTS` — the same table the double-click walks and the
 * drop targets read. That is the whole point of the table existing: before it, where an asset
 * could go was knowledge locked inside one `if` chain, so double-clicking was the only gesture
 * that could send one anywhere.
 *
 * A destination whose space has no document open is shown disabled rather than hidden: a menu
 * that changes length depending on what is open is a menu one cannot learn.
 */
export function AssetMenu({ asset, at, onClose }: AssetMenuProps) {
  const { t } = useTranslation()

  const choose = (run: () => void): void => {
    run()
    onClose()
  }

  return (
    <ContextMenu at={at} onClose={onClose}>
      {intentsFor(asset.type).map(intent => (
        <MenuRow
          key={intent.id}
          label={t(intent.labelKey)}
          icon={intent.icon}
          disabled={!intent.ready()}
          onSelect={() => choose(() => intent.run(asset))}
        />
      ))}
      <MenuRow
        label={t('assets.reveal')}
        icon={mdiFolderOpenOutline}
        disabled={asset.location !== 'local'}
        onSelect={() => choose(() => void getBridge()?.assets.reveal(asset.id))}
      />
    </ContextMenu>
  )
}
