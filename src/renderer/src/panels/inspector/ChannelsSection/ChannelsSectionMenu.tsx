import { mdiCogOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import type { EditPixels } from '@/helpers/openAsset'
import { workspaceById } from '@/helpers/workspaces'
import type { ContextMenuAt } from '@/hooks/useContextMenu'
import { DERIVE_LABELS, type ChannelDerivation } from './derivation'

export type ChannelsSectionMenuProps = {
  derivation: ChannelDerivation | null
  /** Painting the channel — the same gesture the row's double-click carries, and its space. */
  pixels: EditPixels | null
  at: ContextMenuAt
  onClose: () => void
}

/**
 * What a channel can be asked besides being filled: paint its pixels, or compute itself from
 * another channel.
 *
 * A menu rather than two more buttons — the gutter of a property line holds exactly two, browsing
 * and clearing. Reached by right-click and by Shift+F10 alike: the listener sits on the ROW, an
 * ancestor of every control the focus can be on inside it.
 */
export function ChannelsSectionMenu({ derivation, pixels, at, onClose }: ChannelsSectionMenuProps) {
  const { t } = useTranslation()

  return (
    <ContextMenu at={at} onClose={onClose}>
      {pixels && (
        <MenuRow
          label={t('assets.editPixels')}
          // Read off the workspace table, as the shelf's own row is.
          icon={workspaceById(pixels.workspace).icon}
          tip={HINT_RIGHT(t('assets.editPixelsHint'))}
          onSelect={() => {
            pixels.run()
            onClose()
          }}
        />
      )}

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
    </ContextMenu>
  )
}
