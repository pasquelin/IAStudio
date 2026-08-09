import { mdiDeleteOutline, mdiRenameOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { useStyles } from '@/stores/styles'

export type StyleMenuProps = {
  id: string
  at: { x: number; y: number }
  onRename: () => void
  onClose: () => void
}

/** What can be done to a saved style. Renaming is armed by the row; removing ends here. */
export function StyleMenu({ id, at, onRename, onClose }: StyleMenuProps) {
  const { t } = useTranslation()

  return (
    <ContextMenu at={at} onClose={onClose}>
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
    </ContextMenu>
  )
}
