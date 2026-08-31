import { mdiDotsHorizontal } from '@mdi/js'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { ContextMenu } from '@/design/ContextMenu'
import { FieldActions } from '@/design/FieldActions'
import { InlineRename } from '@/design/InlineRename'
import { MenuButton } from '@/design/MenuButton'
import { ROW_LINE, ROW_SUBJECT, rowSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_LEFT, TIP_LEFT } from '@/helpers/tooltip'
import { useContextMenu } from '@/hooks/useContextMenu'
import { useStyles } from '@/stores/styles'
import { renderMenuRows } from '@/design/menuRows'
import { styleMenuRows } from './styleMenuRows'

export type StylesSectionRowProps = {
  style: MaterialStyle
  /** Whether the material in front carries exactly these values — read by comparison, see the section. */
  applied: boolean
  /** Takes the style as an argument rather than in a closure, so `memo` below has something to skip. */
  onApply: (style: MaterialStyle) => void
}

/**
 * One saved style: its name, which applies it, and its menu.
 *
 * The name is the BUTTON because a section has no cell to press. The `tabindex` is what
 * `InlineRename` hands the focus back to when an edit ends — without it a rename left the focus on
 * `document.body`, and the next Tab restarted from the top of the window.
 */
export const StylesSectionRow = memo(function StylesSectionRow({
  style,
  applied,
  onApply,
}: StylesSectionRowProps) {
  const { t } = useTranslation()
  const menu = useContextMenu()
  const [renaming, setRenaming] = useState(false)

  const startRename = useCallback(() => setRenaming(true), [])
  const rows = styleMenuRows(t, style.id, startRename)

  return (
    <li
      tabIndex={-1}
      className={cn(ROW_LINE, 'h-(--sc-control) min-w-0', rowSkin(applied))}
      data-selected={applied || undefined}
      // Not while the name is being typed: the menu would take the field's focus, which
      // `InlineRename` reads as a commit — a right-click would end the rename it opened over.
      onContextMenu={renaming ? undefined : menu.open}
    >
      {renaming ? (
        <InlineRename
          value={style.name}
          label={t('styles.rename')}
          onCommit={name => {
            setRenaming(false)
            if (name !== style.name) void useStyles.getState().rename(style.id, name)
          }}
        />
      ) : (
        <>
          {/* The hint EXPLAINS rather than repeats: the name is on screen, so an `aria-label` here
              would replace it for a reader (WCAG 2.5.3) with a word nobody can see. */}
          <button
            type="button"
            {...HINT_LEFT(t('styles.applyHint'))}
            onClick={() => onApply(style)}
            className={cn(ROW_SUBJECT, 'cursor-pointer border-none bg-transparent p-0 text-left')}
          >
            {style.name}
          </button>
          {/* The keyboard's way to the same two rows. A right-click cannot be one: `contextmenu`
              raised by Shift+F10 targets the focused element, and reaching the listener above it
              depends on the focus being inside this row at all.

              In the end room every property line of the panel keeps, so this button lands on the
              column the channels above end on rather than wherever the name stops. */}
          <FieldActions>
            <MenuButton
              icon={mdiDotsHorizontal}
              label={t('styles.actions')}
              description={t('styles.actionsHint')}
              tooltip={TIP_LEFT}
              variant="header"
              rowCount={rows.length}
              opensOnClick
              rows={close => renderMenuRows(rows, close)}
            />
          </FieldActions>
        </>
      )}

      {menu.at && (
        <ContextMenu at={menu.at} onClose={menu.close}>
          {renderMenuRows(rows, menu.close)}
        </ContextMenu>
      )}
    </li>
  )
})
