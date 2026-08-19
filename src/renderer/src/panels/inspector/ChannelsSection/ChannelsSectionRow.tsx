import { mdiCogOutline, mdiFileImageOutline, mdiTextureBox } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/texture'
import { rowSkin } from '@/design/styles'
import { TileMark } from '@/design/TileMark'
import type { ChannelMap, ChannelOrigin } from '@/engines/texture/textureState'
import { cn } from '@/helpers/cn'
import { useContextMenu } from '@/hooks/useContextMenu'
import { PictureField } from '../PictureField'
import { ChannelsSectionMenu } from './ChannelsSectionMenu'
import type { ChannelDerivation } from './derivation'

export type ChannelsSectionRowProps = {
  channel: PbrChannel
  /** What this channel holds, or `null` for one the material answers with a scalar alone. */
  map: ChannelMap | null
  /** Whether the document is currently showing this channel flat instead of the lit material. */
  inspected: boolean
  derivation: ChannelDerivation | null
  onChange: (assetId: string | null) => void
  onDropAsset: (asset: Asset) => void
  onInspect: () => void
}

/**
 * What each origin looks like. The distinction is the point: a *derived* channel was computed from
 * another channel of this same texture, a *generated* one is frozen at what the model answered, and
 * an *imported* one is the user's own file. Someone about to repaint a height map needs to know.
 */
const ORIGINS: Record<ChannelOrigin, { icon: string; key: string }> = {
  generated: { icon: mdiTextureBox, key: 'texture.originGenerated' },
  derived: { icon: mdiCogOutline, key: 'texture.originDerived' },
  imported: { icon: mdiFileImageOutline, key: 'texture.originImported' },
}

/**
 * One channel of a material, as the link row every texture slot of the studio already is.
 *
 * `rowSkin` says which of the eight is the one shown flat — the studio's one answer to "this line
 * is chosen", never a second blue. Its default surface, so the line does not fill under the
 * pointer: no line of this panel does.
 */
export function ChannelsSectionRow({
  channel,
  map,
  inspected,
  derivation,
  onChange,
  onDropAsset,
  onInspect,
}: ChannelsSectionRowProps) {
  const { t } = useTranslation()
  const menu = useContextMenu()
  const name = t(`texture.channel.${channel}`)
  const origin = map ? ORIGINS[map.origin] : null

  return (
    <div
      className={cn('min-w-0', rowSkin(inspected))}
      data-selected={inspected || undefined}
      // Only where the menu would hold something: a right-click that opens an empty surface is a
      // gesture that answers by covering the row it was aimed at.
      onContextMenu={derivation ? menu.open : undefined}
    >
      <PictureField
        label={name}
        value={map?.assetId ?? null}
        onChange={onChange}
        onDropAsset={onDropAsset}
        scId={`texture.channel.${channel}`}
        open={{
          label: t(inspected ? 'texture.showMaterial' : 'texture.inspectChannel', {
            channel: name,
          }),
          hint: t('texture.inspectChannelHint'),
          run: onInspect,
          toggled: inspected,
        }}
        badge={origin && <TileMark icon={origin.icon} label={t(origin.key)} />}
      />

      {menu.at && derivation && (
        <ChannelsSectionMenu derivation={derivation} at={menu.at} onClose={menu.close} />
      )}
    </div>
  )
}
