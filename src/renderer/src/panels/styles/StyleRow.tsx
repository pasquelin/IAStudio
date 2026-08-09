import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { Row } from '@/design/Row'
import { InlineRename } from '@/panels/shared/InlineRename'
import { useStyles } from '@/stores/styles'
import { StyleMenu } from './StyleMenu'

export type StyleRowProps = { style: MaterialStyle }

/**
 * One saved style, owning its own menu and its own rename — the shape `DraggableAsset` has.
 * Held here rather than in the panel because both are per-row: lifted, opening one row's menu
 * re-rendered every other row in the list.
 *
 * It draws its name and nothing else on purpose: the fifteen values behind it are read by
 * applying it, and a subtitle summarising three of them would go stale against the twelve it
 * left out.
 */
export const StyleRow = memo(function StyleRow({ style }: StyleRowProps) {
  const { t } = useTranslation()
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)

  // Stable, or the open menu re-subscribes its three global listeners on every list refresh.
  const closeMenu = useCallback(() => setMenuAt(null), [])

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
    <div
      className="h-full min-w-0"
      onContextMenu={event => {
        event.preventDefault()
        setMenuAt({ x: event.clientX, y: event.clientY })
      }}
    >
      <Row title={style.name} />
      {menuAt && (
        <StyleMenu
          id={style.id}
          at={menuAt}
          onRename={() => setRenaming(true)}
          onClose={closeMenu}
        />
      )}
    </div>
  )
})
