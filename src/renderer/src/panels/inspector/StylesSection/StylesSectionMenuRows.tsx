import { mdiDeleteOutline, mdiRenameOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useStyles } from '@/stores/styles'

export type StylesSectionMenuRowsProps = {
  id: string
  onRename: () => void
  onClose: () => void
}

/** Two, and the row's button needs to know before it draws. */
export const STYLE_MENU_ROWS = 2

/**
 * What can be done to a saved style, as rows.
 *
 * Rendered by two things — the right-click menu and the row's own button — because a right-click
 * is not a keyboard gesture: `contextmenu` from Shift+F10 targets the focused cell, not the div
 * inside it that listens, so the menu could never be opened without a mouse. Both offer the same
 * two rows rather than the button offering a subset, which would make the two disagree.
 */
export function StylesSectionMenuRows({ id, onRename, onClose }: StylesSectionMenuRowsProps) {
  const { t } = useTranslation()

  return (
    <>
      <MenuRow
        label={t('styles.rename')}
        icon={mdiRenameOutline}
        tip={HINT_RIGHT(t('styles.renameHint'))}
        onSelect={() => {
          onRename()
          onClose()
        }}
      />
      <MenuRow
        label={t('styles.remove')}
        icon={mdiDeleteOutline}
        tip={HINT_RIGHT(t('styles.removeHint'))}
        onSelect={() => {
          void useStyles.getState().remove(id)
          onClose()
        }}
      />
    </>
  )
}
