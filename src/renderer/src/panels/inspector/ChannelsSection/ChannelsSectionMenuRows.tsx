import { mdiCogOutline, mdiImageFilterBlackWhite } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { DERIVE_LABELS, type ChannelDerivation } from './derivation'

export type ChannelsSectionMenuRowsProps = {
  derivation: ChannelDerivation | null
  /** Whether the document is showing this channel flat rather than the lit material. */
  inspected: boolean
  /** The channel's own name, already translated — the row reads it once for both of us. */
  channel: string
  onInspect: () => void
  onClose: () => void
}

/**
 * What a CHANNEL can be asked that no other picture slot can: to be looked at flat, and to be
 * computed from another channel. Everything a SLOT can do is `PictureFieldMenu`'s.
 */
export function ChannelsSectionMenuRows({
  derivation,
  inspected,
  channel,
  onInspect,
  onClose,
}: ChannelsSectionMenuRowsProps) {
  const { t } = useTranslation()

  return (
    <>
      <MenuRow
        label={t(inspected ? 'texture.showMaterial' : 'texture.inspectChannel', { channel })}
        icon={mdiImageFilterBlackWhite}
        tip={HINT_RIGHT(t('texture.inspectChannelHint'))}
        onSelect={() => {
          onInspect()
          onClose()
        }}
      />

      {derivation && (
        <MenuRow
          label={t(DERIVE_LABELS[derivation.state], {
            source: t(`texture.channel.${derivation.source}`),
          })}
          icon={mdiCogOutline}
          disabled={derivation.state !== 'ready'}
          tip={HINT_RIGHT(t('texture.deriveHint'))}
          onSelect={() => {
            derivation.run()
            onClose()
          }}
        />
      )}
    </>
  )
}
