import { mdiDeleteOutline, mdiRenameOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { useStyles } from '@/stores/styles'

export type StyleMenuProps = {
  id: string
  onRename: () => void
  onClose: () => void
}

/**
 * What can be done to a saved style, as rows.
 *
 * Rendered by two things — the right-click menu and the row's own button — because a right-click
 * is not a keyboard gesture: `contextmenu` from Shift+F10 targets the focused cell, not the div
 * inside it that listens, so the menu could never be opened without a mouse. Both offer the same
 * two rows rather than the button offering a subset, which would make the two disagree.
 */
export function StyleMenuRows({ id, onRename, onClose }: StyleMenuProps) {
  const { t } = useTranslation()

  return (
    <>
      <MenuRow
        label={t('styles.rename')}
        icon={mdiRenameOutline}
        onSelect={() => {
          onRename()
          onClose()
        }}
      />
      <MenuRow
        label={t('styles.remove')}
        icon={mdiDeleteOutline}
        onSelect={() => {
          void useStyles.getState().remove(id)
          onClose()
        }}
      />
    </>
  )
}

/** The same rows, at the pointer. */
export function StyleMenu({
  id,
  at,
  onRename,
  onClose,
}: StyleMenuProps & { at: { x: number; y: number } }) {
  return (
    <ContextMenu at={at} onClose={onClose}>
      <StyleMenuRows id={id} onRename={onRename} onClose={onClose} />
    </ContextMenu>
  )
}

/** Two, and the row's button needs to know before it draws. */
export const STYLE_MENU_ROWS = 2
