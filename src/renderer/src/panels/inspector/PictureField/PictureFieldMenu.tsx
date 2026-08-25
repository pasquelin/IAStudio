import { mdiClose, mdiFolderSearchOutline, mdiOpenInNew } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import type { ContextMenuAt } from '@/hooks/useContextMenu'

export type PictureFieldMenuProps = {
  at: ContextMenuAt
  onClose: () => void
  /** The picker — the same window the single click and the browse button open. */
  onBrowse: () => void
  /** What the double-click opens, already named by the caller. Absent where nothing opens. */
  open?: { label: string; hint: string; run: () => void; icon?: string }
  /** Emptying the slot, where that is a state it has. */
  onClear?: () => void
  /** Rows belonging to the surface rather than to the slot — a channel's flat view, its recipe. */
  extra?: ReactNode
}

/**
 * The third gesture of every picture slot, written once.
 *
 * A material's channels grew one first, and it held what only they can do. Everything a SLOT can
 * do belongs here instead: choosing, opening, emptying — so the four surfaces that draw a picture
 * row answer the same right-click.
 */
export function PictureFieldMenu({
  at,
  onClose,
  onBrowse,
  open,
  onClear,
  extra,
}: PictureFieldMenuProps) {
  const { t } = useTranslation()

  const chosen = (run: () => void) => () => {
    run()
    onClose()
  }

  return (
    <ContextMenu at={at} onClose={onClose}>
      <MenuRow
        label={t('inspector.pickPicture')}
        icon={mdiFolderSearchOutline}
        tip={HINT_RIGHT(t('inspector.pickPictureHint'))}
        onSelect={chosen(onBrowse)}
      />

      {open && (
        <MenuRow
          label={open.label}
          icon={open.icon ?? mdiOpenInNew}
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
