import {
  mdiCogOutline,
  mdiDeleteOutline,
  mdiDotsHorizontal,
  mdiFileImageOutline,
  mdiImageOffOutline,
  mdiTextureBox,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { PbrChannel } from '@shared/domain/texture'
import { cn } from '@/helpers/cn'
import { usePosterUrl } from '@/hooks/usePosterUrl'
import { HINT_RIGHT, TIP_LEFT } from '@/helpers/tooltip'
import { FOCUS_RING, rowSkin } from '@/design/styles'
import { MediaTile } from '@/design/MediaTile'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { UiIcon } from '@/design/UiIcon'
import type { ChannelMap, ChannelOrigin } from '@/engines/texture/texture-state'

/**
 * Where a derivation stands, as one value rather than three booleans that could contradict one
 * another. `missing` and `blocked` are offered and refused rather than hidden: each names what
 * is in the way, and a row that simply is not there leaves nothing to read that from.
 */
export type DerivationState = 'ready' | 'missing' | 'running' | 'blocked'

const DERIVE_LABELS: Record<DerivationState, string> = {
  ready: 'texture.derive',
  missing: 'texture.deriveMissing',
  running: 'texture.deriving',
  blocked: 'texture.deriveBusy',
}

/**
 * What this channel can compute itself from, when anything can. `null` for the four a shader
 * has no recipe for — offering the row there would promise a result nothing can produce.
 */
export type ChannelDerivation = {
  source: PbrChannel
  state: DerivationState
  run: () => void
}

export type ChannelTileProps = {
  channel: PbrChannel
  map: ChannelMap | null
  /** Pictures of the project this channel could hold, already filtered to what can be decoded. */
  options: readonly { id: string; name: string }[]
  /** Whether the document is currently showing this channel flat instead of the lit material. */
  inspected: boolean
  derivation: ChannelDerivation | null
  onPick: (assetId: string) => void
  onClear: () => void
  onInspect: () => void
}

/**
 * What each origin looks like. A glyph rather than a colour alone, for the reason `AssetBadge`
 * gives: three states have to be told apart on a small tile, and none of them is alarming.
 *
 * The distinction is the point of the badge: a *derived* channel was computed from another
 * channel of this same texture, a *generated* one is frozen at what the model answered, and an
 * *imported* one is the user's own file. Someone about to repaint a height map needs to know
 * which.
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
  derivation,
  onPick,
  onClear,
  onInspect,
}: ChannelTileProps) {
  const { t } = useTranslation()
  const poster = usePosterUrl(map?.assetId)
  const name = t(`texture.channel.${channel}`)
  const origin = map ? ORIGINS[map.origin] : null
  const label = t(inspected ? 'texture.showMaterial' : 'texture.inspectChannel', { channel: name })

  return (
    // Selection is painted by the container, not by the tile inside it, and through `rowSkin` —
    // the studio's one answer to "this line is chosen", so a channel cannot light up differently
    // from an asset. `p-0.5` is what lets the tint show as a frame around the picture.
    <div
      className={cn('relative p-0.5', rowSkin(inspected))}
      data-selected={inspected || undefined}
    >
      <MediaTile url={poster} caption={name} fallbackIcon={mdiTextureBox} />

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
        {...TIP_LEFT(label)}
        onClick={onInspect}
        className={cn(
          'absolute inset-0 cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
          'disabled:cursor-default',
          FOCUS_RING,
        )}
      />

      {/* After the button rather than in `MediaTile`'s badge slot, and for the same reason the
          menu is: the button covers the whole tile, so a badge underneath it can be seen but
          never hovered, and its `title` never opened. Top LEFT — the menu owns the other corner. */}
      {origin && (
        <span
          className="bg-chassis/75 text-text absolute top-1 left-1 rounded-(--radius-sc-sm) p-px"
          title={t(origin.key)}
          aria-label={t(origin.key)}
          role="img"
        >
          <UiIcon path={origin.icon} size={12} />
        </span>
      )}

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
            ...(derivation
              ? [
                  <MenuRow
                    key="derive"
                    label={t(DERIVE_LABELS[derivation.state], {
                      source: t(`texture.channel.${derivation.source}`),
                    })}
                    icon={mdiCogOutline}
                    disabled={derivation.state !== 'ready'}
                    tip={HINT_RIGHT(t('texture.deriveHint'))}
                    onSelect={() => {
                      derivation.run()
                      close()
                    }}
                  />,
                ]
              : []),
            <MenuRow
              key="clear"
              label={t('texture.clearChannel')}
              icon={mdiDeleteOutline}
              checked={map === null}
              tick="one-of"
              tip={HINT_RIGHT(t('texture.clearChannelHint'))}
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
                    tip={HINT_RIGHT(t('texture.noPictureHint'))}
                    onSelect={() => undefined}
                  />,
                ]
              : options.map(option => (
                  <MenuRow
                    key={option.id}
                    label={option.name}
                    icon={mdiFileImageOutline}
                    checked={map?.assetId === option.id}
                    tick="one-of"
                    tip={HINT_RIGHT(t('texture.pickChannelHint'))}
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
