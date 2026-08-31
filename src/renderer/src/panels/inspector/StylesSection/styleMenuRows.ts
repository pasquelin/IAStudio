import { mdiDeleteOutline, mdiRenameOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import type { MenuRowSpec } from '@/design/menuRows'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useStyles } from '@/stores/styles'

/**
 * What can be done to a saved style, as rows.
 *
 * Read by two things — the right-click menu and the row's own button — because a right-click is
 * not a keyboard gesture: `contextmenu` from Shift+F10 targets the focused cell, not the div
 * inside it that listens. Both read the same list rather than the button offering a subset.
 *
 * Data rather than JSX so the button that opens them COUNTS them: the figure it needs was kept
 * beside the list by hand, where nothing made the two agree.
 */
export function styleMenuRows(t: TFunction, id: string, onRename: () => void): MenuRowSpec[] {
  return [
    {
      key: 'rename',
      label: t('styles.rename'),
      icon: mdiRenameOutline,
      tip: HINT_RIGHT(t('styles.renameHint')),
      onSelect: close => {
        onRename()
        close()
      },
    },
    {
      key: 'remove',
      label: t('styles.remove'),
      icon: mdiDeleteOutline,
      tip: HINT_RIGHT(t('styles.removeHint')),
      onSelect: close => {
        void useStyles.getState().remove(id)
        close()
      },
    },
  ]
}
