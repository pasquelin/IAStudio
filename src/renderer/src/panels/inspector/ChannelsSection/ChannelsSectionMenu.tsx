import { mdiCogOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { DERIVE_LABELS, type ChannelDerivation } from './derivation'

export type ChannelsSectionMenuProps = {
  derivation: ChannelDerivation
  at: { x: number; y: number }
  onClose: () => void
}

/**
 * What a channel can be asked besides being filled: compute itself from another channel.
 *
 * A menu rather than a third button, because the gutter of a property line holds exactly two —
 * browsing and clearing, the same two every texture slot of the studio ends on. Reached by
 * right-click and by Shift+F10 alike: the listener sits on the row, which is an ANCESTOR of every
 * control the focus can be on inside it, so the keyboard's event bubbles up to it.
 */
export function ChannelsSectionMenu({ derivation, at, onClose }: ChannelsSectionMenuProps) {
  const { t } = useTranslation()

  return (
    <ContextMenu at={at} onClose={onClose}>
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
    </ContextMenu>
  )
}
