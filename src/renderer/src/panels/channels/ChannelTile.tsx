import {
  mdiCogOutline,
  mdiDeleteOutline,
  mdiDotsHorizontal,
  mdiFileImageOutline,
  mdiImageOffOutline,
  mdiTextureBox,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { assetUrl } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/texture'
import { cn } from '@/helpers/cn'
import { TIP_LEFT } from '@/helpers/tooltip'
import { FOCUS_RING, rowSkin } from '@/design/styles'
import { MediaTile } from '@/design/MediaTile'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { UiIcon } from '@/design/UiIcon'
import type { ChannelMap, ChannelOrigin } from '@/engines/texture/texture-state'

export type ChannelTileProps = {
  channel: PbrChannel
  map: ChannelMap | null
  /** Pictures of the project this channel could hold, already filtered to what can be decoded. */
  options: readonly { id: string; name: string }[]
  /** Whether the document is currently showing this channel flat instead of the lit material. */
  inspected: boolean
  onPick: (assetId: string) => void
  onClear: () => void
  onInspect: () => void
}

/**
 * What each origin looks like. A glyph rather than a colour alone, for the reason `AssetBadge`
 * gives: three states have to be told apart on a small tile, and none of them is alarming.
 *
 * The distinction is the point of the badge: a *derived* channel is recomputed whenever its
 * source changes, a *generated* one is frozen at what the model answered, and an *imported* one
 * is the user's own file. Someone about to repaint a height map needs to know which.
 */
const ORIGINS: Record<ChannelOrigin, { icon: string; key: string }> = {
  generated: { icon: mdiTextureBox, key: 'texture.originGenerated' },
  derived: { icon: mdiCogOutline, key: 'texture.originDerived' },
  imported: { icon: mdiFileImageOutline, key: 'texture.originImported' },
}

/** One channel of a material: what it holds, where those pixels came from, and how to change it. */
export function ChannelTile({
  channel,
  map,
  options,
  inspected,
  onPick,
  onClear,
  onInspect,
}: ChannelTileProps) {
  const { t } = useTranslation()
  const name = t(`texture.channel.${channel}`)
  const origin = map ? ORIGINS[map.origin] : null
  const label = t(inspected ? 'texture.showMaterial' : 'texture.inspectChannel', { channel: name })

  return (
    // Selection is painted by the container, not by the tile inside it, and through `rowSkin` —
    // the studio's one answer to "this line is chosen", so a channel cannot light up differently
    // from an asset. `p-0.5` is what lets the tint show as a frame around the picture.
    <div className={cn('relative p-0.5', rowSkin(inspected))}>
      <MediaTile
        url={map ? assetUrl(map.assetId) : undefined}
        caption={name}
        fallbackIcon={mdiTextureBox}
        badge={
          origin && (
            // Top LEFT: the menu button owns the other corner. `MediaTile` hands its slot straight
            // through, so the corner belongs to the badge — same chrome as `AssetBadge` overlay.
            <span
              className="bg-chassis/75 text-text absolute top-1 left-1 rounded-(--radius-sc-sm) p-px"
              title={t(origin.key)}
              aria-label={t(origin.key)}
              role="img"
            >
              <UiIcon path={origin.icon} size={12} />
            </span>
          )
        }
      />

      {/* Laid over the tile rather than wrapped around it: `MediaTile` renders a `figure`, and a
          `button` takes phrasing content only. Before the menu in the DOM, so the menu stays on
          top of it without either needing a z-index. */}
      <button
        type="button"
        aria-pressed={inspected}
        // Nothing to look at flat: an empty channel would show a blank frame and say nothing.
        disabled={!map}
        // Named outright: the accessible name would otherwise be the tile's caption, which says
        // which channel this is and nothing about what pressing it does.
        aria-label={label}
        title={label}
        onClick={onInspect}
        className={cn(
          'absolute inset-0 cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
          'disabled:cursor-default',
          FOCUS_RING,
        )}
      />

      <div className="absolute top-1 right-1">
        <MenuButton
          icon={mdiDotsHorizontal}
          label={t('texture.chooseChannel', { channel: name })}
          tooltip={TIP_LEFT}
          variant="header"
          opensOnClick
          /**
           * "Empty" is always offered — choosing no picture is choosing, as `TextureField` has it
           * — plus one row per picture, or a disabled row saying there is none. Never fewer than
           * two, and that is the point: `MenuButton` acts outright instead of opening on a single
           * row, so a project holding no picture left the one remaining action, emptying the
           * channel, behind a button that looked alive and did nothing.
           */
          rowCount={Math.max(options.length + 1, 2)}
          rows={close => [
            <MenuRow
              key="clear"
              label={t('texture.clearChannel')}
              icon={mdiDeleteOutline}
              checked={map === null}
              onSelect={() => {
                onClear()
                close()
              }}
            />,
            // Says WHY there is no choice, rather than a button that refuses without a word.
            ...(options.length === 0
              ? [
                  <MenuRow
                    key="none"
                    label={t('texture.noPicture')}
                    icon={mdiImageOffOutline}
                    disabled
                    onSelect={() => undefined}
                  />,
                ]
              : options.map(option => (
                  <MenuRow
                    key={option.id}
                    label={option.name}
                    icon={mdiFileImageOutline}
                    checked={map?.assetId === option.id}
                    onSelect={() => {
                      onPick(option.id)
                      close()
                    }}
                  />
                ))),
          ]}
        />
      </div>
    </div>
  )
}
