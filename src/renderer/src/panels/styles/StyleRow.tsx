import { mdiDotsHorizontal } from '@mdi/js'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { useContextMenu } from '@/design/ContextMenu'
import { MenuButton } from '@/design/MenuButton'
import { Row } from '@/design/Row'
import { TIP_LEFT } from '@/helpers/tooltip'
import { InlineRename } from '@/panels/shared/InlineRename'
import { useStyles } from '@/stores/styles'
import { StyleMenu, StyleMenuRows, STYLE_MENU_ROWS } from './StyleMenu'

export type StyleRowProps = { style: MaterialStyle }

/**
 * One saved style, owning its own menu and its own rename — the shape `DraggableAsset` has.
 * Held here rather than in the panel because both are per-row: lifted, opening one row's menu
 * re-rendered every other row in the list.
 *
 * `memo` earns less here than on an asset card, and it is worth saying so: every write answers
 * with the whole list re-read from disk, so a rename gives all the rows a new identity, not just
 * the one that changed. What it does catch is a re-render this list has no part in — switching
 * the texture in front, which happens far more often than a style is saved.
 *
 * It draws its name and nothing else besides the menu: the fifteen values behind it are read by
 * applying it, and a subtitle summarising three of them would go stale against the twelve it
 * left out.
 */
export const StyleRow = memo(function StyleRow({ style }: StyleRowProps) {
  const { t } = useTranslation()
  const menu = useContextMenu()
  const [renaming, setRenaming] = useState(false)

  const startRename = useCallback(() => setRenaming(true), [])

  if (renaming) {
    return (
      <div className="flex h-full min-w-0 items-center px-1">
        <InlineRename
          value={style.name}
          label={t('styles.rename')}
          onCommit={name => {
            setRenaming(false)
            if (name !== style.name) void useStyles.getState().rename(style.id, name)
          }}
        />
      </div>
    )
  }

  return (
    <div className="h-full min-w-0" onContextMenu={menu.open}>
      <Row
        title={style.name}
        actions={
          // The keyboard's way to the same two rows. A right-click cannot be one: `contextmenu`
          // raised by Shift+F10 targets the focused cell, and the listener is on the div inside
          // it — an event never walks down into its own descendants.
          <MenuButton
            icon={mdiDotsHorizontal}
            label={t('styles.actions')}
            description={t('styles.actionsHint')}
            tooltip={TIP_LEFT}
            variant="header"
            rowCount={STYLE_MENU_ROWS}
            opensOnClick
            rows={close => <StyleMenuRows id={style.id} onRename={startRename} onClose={close} />}
          />
        }
      />
      {menu.at && (
        <StyleMenu id={style.id} at={menu.at} onRename={startRename} onClose={menu.close} />
      )}
    </div>
  )
})
