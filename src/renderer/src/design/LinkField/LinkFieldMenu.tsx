import { mdiClose, mdiFolderSearchOutline, mdiOpenInNew } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { HINT_RIGHT } from '@/helpers/tooltip'
import type { ContextMenuAt } from '@/hooks/useContextMenu'
import { ContextMenu } from '../ContextMenu'
import { MenuRow } from '../MenuRow'
import type { LinkPress } from './linkPress'

export type LinkFieldMenuProps = {
  at: ContextMenuAt
  onClose: () => void
  /** The picker — the same window the single click and the browse button open. */
  browse?: LinkPress
  /** What the double-click opens. The words are the caller's, and the menu reads them out loud. */
  open?: LinkPress
  /** Emptying the slot, where that is a state it has. */
  onClear?: () => void
  /** Rows belonging to the surface rather than to the slot — a channel's flat view, its recipe. */
  extra?: ReactNode
}

/**
 * The third gesture of every link row, written once: everything the SLOT can do — choose, open,
 * empty — beside whatever the surface adds.
 */
export function LinkFieldMenu({ at, onClose, browse, open, onClear, extra }: LinkFieldMenuProps) {
  const { t } = useTranslation()

  const chosen = (run: () => void) => () => {
    run()
    onClose()
  }

  return (
    <ContextMenu at={at} onClose={onClose}>
      {browse && (
        <MenuRow
          label={browse.label}
          icon={mdiFolderSearchOutline}
          tip={HINT_RIGHT(browse.hint)}
          onSelect={chosen(browse.run)}
        />
      )}

      {open && (
        <MenuRow
          label={open.label}
          icon={mdiOpenInNew}
          tip={HINT_RIGHT(open.hint)}
          onSelect={chosen(open.run)}
        />
      )}

      {extra}

      {onClear && (
        <MenuRow
          label={t('inspector.clearTexture')}
          icon={mdiClose}
          tip={HINT_RIGHT(t('inspector.clearTextureHint'))}
          onSelect={chosen(onClear)}
        />
      )}
    </ContextMenu>
  )
}
